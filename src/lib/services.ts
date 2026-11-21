// Operações de leitura e escrita no banco. Não dependem do Next.js, então
// podem ser exercitadas direto nos testes.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  editions,
  entries,
  matches,
  playerPhotos,
  teamBadges,
  players,
  teamChoices,
  teams,
  type Edition,
  type Entry,
  type Match,
  type Player,
  type Team,
} from "@/db/schema";
import {
  ApiFootballError,
  LEAGUES,
  bestMatch,
  catalogLeague,
  currentSeason,
  downloadBadge,
  leagueCountries,
  leagueTeams,
  rankCandidates,
  searchTeams,
} from "./apiFootball";
import catalog from "../../scripts/times.json";
import { RESULT_ORDER, resultRank } from "./labels";
import {
  BANS_PER_PLAYER,
  PICKS_PER_PLAYER,
  choiceState,
  turnOrder,
  foldTeam,
} from "./teamChoice";
import { PHOTO_MAX_BYTES, isUploadedPhoto, photoPath } from "./photo";
import { parseAvatar, type AvatarLook } from "./sprite";
import type { AllData } from "./stats";
import {
  GROUP_LABELS,
  isEditableSlot,
  knockoutRounds,
  assignGroups,
  computeResults,
  computeStandings,
  normalizeConfig,
  planMatches,
  resolveKnockout,
  validateConfig,
  validateGroupSizes,
  type Format,
  type FormatConfig,
  type Pairing,
  type ResultCode,
} from "./tournament";

/** Erro com mensagem pensada para aparecer na tela. */
export class UserError extends Error {}

const FORMATS: Format[] = ["grupos", "liga", "mata", "manual"];

function clean(value: unknown, max = 80) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function configOf(edition: Edition): FormatConfig {
  return {
    format: edition.format as Format,
    groupsCount: edition.groupsCount,
    legs: edition.legs,
    pairing: edition.pairing as Pairing,
    crossGames: edition.crossGames,
    qualifiers: edition.qualifiers,
    thirdPlace: edition.thirdPlace,
    playoffs: edition.playoffs,
  };
}

// ---------------------------------------------------------------------------
// Jogadores

/** Colunas públicas do jogador: tudo menos o hash do link de acesso. */
export const playerColumns = {
  id: players.id,
  name: players.name,
  photoUrl: players.photoUrl,
  avatar: players.avatar,
  createdAt: players.createdAt,
};

export async function listPlayers(db: Db) {
  const rows = await db.select(playerColumns).from(players);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// A comparação de nomes é feita aqui e não no SQL porque o lower() do SQLite
// ignora letras acentuadas ("Íbis" e "íbis" seriam nomes diferentes).
const sameName = (a: string, b: string) =>
  a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");

async function findPlayerByName(db: Db, name: string) {
  const rows = await db.select().from(players);
  return rows.find((p) => sameName(p.name, name)) ?? null;
}

/**
 * Link externo de foto: só https. `current` é o link já salvo; um link antigo
 * em http continua aceito enquanto não for trocado, para salvar o jogador com
 * outra mudança (o nome, por exemplo) não falhar por causa dele.
 */
function cleanPhotoUrl(value: unknown, current?: string | null) {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (current && url === current && /^https?:\/\/\S+$/i.test(url)) return url;
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 500)
    throw new UserError("O link da foto precisa começar com https://.");
  return url;
}

interface PhotoData {
  contentType: string;
  base64: string;
}

/** Valida a foto enviada ("data:image/jpeg;base64,..."); devolve null se não veio nada. */
function parsePhotoData(value: unknown): PhotoData | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const m =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      text,
    );
  if (!m)
    throw new UserError("Foto inválida. Use uma imagem JPG, PNG ou WebP.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > PHOTO_MAX_BYTES)
    throw new UserError("A foto ficou grande demais. Tente uma imagem menor.");
  // Confere o conteúdo, e não só o que o envio diz ser.
  const starts = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  const isJpeg = starts(0xff, 0xd8, 0xff);
  const isPng = starts(0x89, 0x50, 0x4e, 0x47);
  const isWebp =
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isJpeg && !isPng && !isWebp)
    throw new UserError("Foto inválida. Use uma imagem JPG, PNG ou WebP.");
  return { contentType: m[1], base64: m[2] };
}

async function storePhoto(db: Db, playerId: number, photo: PhotoData) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(playerPhotos)
    .values({
      playerId,
      contentType: photo.contentType,
      data: photo.base64,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: playerPhotos.playerId,
      set: { contentType: photo.contentType, data: photo.base64, updatedAt },
    });
  return photoPath(playerId);
}

/** Foto enviada de um jogador, ou null. */
export async function getPlayerPhoto(db: Db, playerId: number) {
  const [row] = await db
    .select()
    .from(playerPhotos)
    .where(eq(playerPhotos.playerId, playerId));
  return row ? { contentType: row.contentType, data: row.data } : null;
}

export async function createPlayer(
  db: Db,
  rawName: unknown,
  photo?: unknown,
  /** Foto enviada, como "data:image/...;base64,...". Vale mais que o link. */
  photoData?: unknown,
) {
  const name = clean(rawName, 40);
  if (!name) throw new UserError("Informe o nome do jogador.");
  if (await findPlayerByName(db, name))
    throw new UserError(`Já existe um jogador chamado ${name}.`);
  // Valida tudo antes de gravar, para uma foto ruim não deixar o jogador pela metade.
  const upload = parsePhotoData(photoData);
  const link = upload ? null : cleanPhotoUrl(photo);
  const [row] = await db
    .insert(players)
    .values({ name, photoUrl: link })
    .returning();
  if (!upload) return row;
  const photoUrl = await storePhoto(db, row.id, upload);
  await db.update(players).set({ photoUrl }).where(eq(players.id, row.id));
  return { ...row, photoUrl };
}

export async function updatePlayer(
  db: Db,
  id: number,
  input: {
    name: unknown;
    photoUrl: unknown;
    /** Aparência escolhida; null volta ao automático; sem informar, não muda. */
    avatar?: unknown;
    /** Foto nova enviada ("data:image/...;base64,..."); vale mais que o link. */
    photoData?: unknown;
    /** Tirar a foto atual (enviada ou link). */
    removePhoto?: boolean;
  },
) {
  const name = clean(input.name, 40);
  if (!name) throw new UserError("Informe o nome do jogador.");
  const other = await findPlayerByName(db, name);
  if (other && other.id !== id)
    throw new UserError(`Já existe um jogador chamado ${name}.`);
  const avatar =
    input.avatar === undefined
      ? {}
      : { avatar: input.avatar === null ? null : requireAvatar(input.avatar) };
  const [current] = await db.select().from(players).where(eq(players.id, id));
  if (!current) throw new UserError("Jogador não encontrado.");

  // Foto: enviada > link novo > manter a enviada > link. O campo de link só
  // cuida de links externos; ele vazio não apaga uma foto enviada.
  const upload = parsePhotoData(input.photoData);
  const link = cleanPhotoUrl(input.photoUrl, current.photoUrl);
  let photoUrl: string | null;
  if (upload) {
    photoUrl = await storePhoto(db, id, upload);
  } else if (input.removePhoto && !link) {
    await db.delete(playerPhotos).where(eq(playerPhotos.playerId, id));
    photoUrl = null;
  } else if (link) {
    await db.delete(playerPhotos).where(eq(playerPhotos.playerId, id));
    photoUrl = link;
  } else {
    photoUrl = isUploadedPhoto(current.photoUrl) ? current.photoUrl : null;
  }
  await db
    .update(players)
    .set({ name, photoUrl, ...avatar })
    .where(eq(players.id, id));
}

/**
 * Atualiza só o que o próprio jogador pode mudar: foto e avatar. O nome (que
 * aparece no histórico e no ranking) continua só com o organizador.
 */
export async function updatePlayerProfile(
  db: Db,
  id: number,
  input: {
    photoUrl: unknown;
    avatar?: unknown;
    photoData?: unknown;
    removePhoto?: boolean;
  },
) {
  const [current] = await db.select().from(players).where(eq(players.id, id));
  if (!current) throw new UserError("Jogador não encontrado.");
  await updatePlayer(db, id, { ...input, name: current.name });
}

// --- Acesso do jogador ao próprio perfil -----------------------------------

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Gera um link de acesso novo para o jogador (o anterior deixa de valer).
 * Devolve o código em si, que só existe neste momento: no banco fica o hash.
 */
export async function createPlayerAccess(db: Db, playerId: number) {
  const token = randomBytes(24).toString("base64url");
  const updated = await db
    .update(players)
    .set({ accessHash: hashToken(token) })
    .where(eq(players.id, playerId))
    .returning({ id: players.id });
  if (updated.length === 0) throw new UserError("Jogador não encontrado.");
  return token;
}

/** Desativa o acesso: o link e as sessões abertas deixam de valer. */
export async function revokePlayerAccess(db: Db, playerId: number) {
  await db
    .update(players)
    .set({ accessHash: null })
    .where(eq(players.id, playerId));
}

export async function playerHasAccess(db: Db, playerId: number) {
  const [row] = await db
    .select({ accessHash: players.accessHash })
    .from(players)
    .where(eq(players.id, playerId));
  return row?.accessHash != null;
}

/** Jogador dono de um link de acesso (ou undefined se o código não vale). */
export async function findPlayerByAccessToken(db: Db, token: string) {
  if (!token || token.length > 100) return undefined;
  const [row] = await db
    .select({ id: players.id, accessHash: players.accessHash })
    .from(players)
    .where(eq(players.accessHash, hashToken(token)));
  return row;
}

/** Hash atual do acesso do jogador, para conferir se uma sessão ainda vale. */
export async function getPlayerAccessHash(db: Db, playerId: number) {
  const [row] = await db
    .select({ accessHash: players.accessHash })
    .from(players)
    .where(eq(players.id, playerId));
  return row?.accessHash ?? null;
}

function requireAvatar(value: unknown): AvatarLook {
  const look = parseAvatar(value);
  if (!look) throw new UserError("Aparência do avatar inválida.");
  return look;
}

export async function deletePlayer(db: Db, id: number) {
  const used = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.playerId, id))
    .limit(1);
  if (used.length)
    throw new UserError(
      "Este jogador já participou de alguma edição e não pode ser excluído.",
    );
  await db.delete(playerPhotos).where(eq(playerPhotos.playerId, id));
  await db.delete(players).where(eq(players.id, id));
}

// ---------------------------------------------------------------------------
// Times

async function ensureTeam(db: Db, rawName: string): Promise<Team> {
  const name = clean(rawName, 60);
  const found = (await db.select().from(teams)).find((t) =>
    sameName(t.name, name),
  );
  if (found) return found;
  const [row] = await db.insert(teams).values({ name }).returning();
  return row;
}

export function cleanTeamList(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const name = clean(item, 60);
    const key = name.toLocaleLowerCase("pt-BR");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 128);
}

// ---------------------------------------------------------------------------
// Edições

export interface EditionInput {
  name: unknown;
  number: unknown;
  game: unknown;
  playedOn: unknown;
  notes?: unknown;
  /** Falso = torneio só com os jogadores. Sem informar, usa times. */
  useTeams?: unknown;
  config: FormatConfig;
}

function parseEditionMeta(input: EditionInput) {
  const name = clean(input.name);
  const game = clean(input.game, 40);
  const number = Number(input.number);
  const playedOn = String(input.playedOn ?? "").trim() || null;
  if (!name) throw new UserError("Dê um nome para a edição.");
  if (!game) throw new UserError("Informe o jogo (FIFA, Bomba Patch...).");
  if (!Number.isInteger(number) || number < 1)
    throw new UserError("O número da edição precisa ser 1 ou mais.");
  if (playedOn && !/^\d{4}-\d{2}-\d{2}$/.test(playedOn))
    throw new UserError("Data inválida.");
  return {
    name,
    game,
    number,
    playedOn,
    notes: clean(input.notes, 500) || null,
    useTeams: input.useTeams === undefined ? true : Boolean(input.useTeams),
  };
}

function parseConfig(config: FormatConfig) {
  if (!FORMATS.includes(config.format))
    throw new UserError("Formato inválido.");
  return normalizeConfig({
    format: config.format,
    groupsCount: Number(config.groupsCount) || 0,
    legs: Number(config.legs) || 1,
    pairing: config.pairing,
    crossGames: Number(config.crossGames) || 0,
    qualifiers: Number(config.qualifiers) || 0,
    thirdPlace: Boolean(config.thirdPlace),
    playoffs: Number(config.playoffs) || 0,
  });
}

export async function nextEditionNumber(db: Db) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${editions.number})` })
    .from(editions);
  return (row?.max ?? 0) + 1;
}

export async function createEdition(
  db: Db,
  input: EditionInput & {
    playerIds: number[];
    newPlayerNames?: unknown[];
    teamPool?: unknown[];
  },
) {
  const meta = parseEditionMeta(input);
  const config = parseConfig(input.config);
  const newNames = [
    ...new Set((input.newPlayerNames ?? []).map((n) => clean(n, 40))),
  ].filter(Boolean);

  return db.transaction(async (tx) => {
    const ids = new Set(input.playerIds.filter(Number.isInteger));
    for (const name of newNames) {
      const existing = await findPlayerByName(tx, name);
      ids.add((existing ?? (await createPlayer(tx, name))).id);
    }
    if (ids.size) {
      const found = await tx
        .select({ id: players.id })
        .from(players)
        .where(inArray(players.id, [...ids]));
      if (found.length !== ids.size)
        throw new UserError("Jogador não encontrado.");
    }
    const [edition] = await tx
      .insert(editions)
      .values({
        ...meta,
        ...config,
        status: config.format === "manual" ? "encerrada" : "inscricoes",
        teamPool: meta.useTeams ? cleanTeamList(input.teamPool ?? []) : [],
      })
      .returning();
    if (ids.size) {
      await tx.insert(entries).values(
        [...ids].map((playerId, seed) => ({
          editionId: edition.id,
          playerId,
          seed,
        })),
      );
    }
    return edition;
  });
}

async function getEdition(db: Db, id: number) {
  const [edition] = await db.select().from(editions).where(eq(editions.id, id));
  if (!edition) throw new UserError("Edição não encontrada.");
  return edition;
}

export async function updateEdition(db: Db, id: number, input: EditionInput) {
  const edition = await getEdition(db, id);
  const meta = parseEditionMeta(input);
  // O formato só pode mudar antes de a tabela ser gerada.
  const canChangeFormat =
    edition.status === "inscricoes" && input.config.format !== "manual";
  const config = canChangeFormat ? parseConfig(input.config) : {};
  // Usar times ou não também só muda antes de gerar a tabela.
  const { useTeams, ...rest } = meta;
  const canChangeTeams = edition.status === "inscricoes";
  await db.transaction(async (tx) => {
    await tx
      .update(editions)
      .set({
        ...rest,
        ...config,
        ...(canChangeTeams
          ? { useTeams, ...(useTeams ? {} : { teamPool: [] }) }
          : {}),
      })
      .where(eq(editions.id, id));
    if (canChangeTeams && !useTeams) {
      // Sem times: quem já tinha um perde o vínculo.
      await tx
        .update(entries)
        .set({ teamId: null })
        .where(eq(entries.editionId, id));
    }
  });
}

function assertEditable(edition: Edition) {
  if (edition.format !== "manual" && edition.status !== "inscricoes")
    throw new UserError(
      "A tabela já foi gerada. Desfaça a tabela para mudar os participantes.",
    );
}

/** Tira um participante da edição (só antes de a tabela existir). */
export async function removeEntry(db: Db, entryId: number) {
  const entry = await getEntry(db, entryId);
  assertEditable(await getEdition(db, entry.editionId));
  await db.delete(entries).where(eq(entries.id, entryId));
}

export async function setParticipants(
  db: Db,
  editionId: number,
  playerIds: number[],
) {
  const edition = await getEdition(db, editionId);
  assertEditable(edition);
  const wanted = new Set(playerIds.filter(Number.isInteger));
  await db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(entries)
      .where(eq(entries.editionId, editionId));
    const remove = current.filter((e) => !wanted.has(e.playerId));
    if (remove.length) {
      await tx.delete(entries).where(
        inArray(
          entries.id,
          remove.map((e) => e.id),
        ),
      );
    }
    const have = new Set(current.map((e) => e.playerId));
    const add = [...wanted].filter((id) => !have.has(id));
    if (add.length) {
      let seed = current.reduce((max, e) => Math.max(max, e.seed), -1);
      await tx
        .insert(entries)
        .values(add.map((playerId) => ({ editionId, playerId, seed: ++seed })));
    }
  });
}

export async function setTeamPool(db: Db, editionId: number, names: unknown[]) {
  await getEdition(db, editionId);
  await db
    .update(editions)
    .set({ teamPool: cleanTeamList(names) })
    .where(eq(editions.id, editionId));
}

// ---------------------------------------------------------------------------
// Escolha dos times: cada jogador cita times, depois cada um bane um deles.
// Quando todos baniram, o que sobrou vira a lista de times do sorteio.

/** Escolhas e banimentos já lançados numa edição, na ordem em que foram feitos. */
export async function listTeamChoices(db: Db, editionId: number) {
  return db
    .select()
    .from(teamChoices)
    .where(eq(teamChoices.editionId, editionId))
    .orderBy(teamChoices.id);
}

/**
 * Ordem de jogada da escolha dos times: pela colocação final na edição
 * anterior já encerrada (empates na mesma fase pela campanha na edição);
 * quem não jogou a anterior ou é estreante vai por último.
 */
export function choiceTurnOrder(data: AllData, editionId: number) {
  const sorted = sortEditions(data.editions);
  const at = sorted.findIndex((e) => e.id === editionId);
  const previous =
    sorted
      .slice(at + 1)
      .find(
        (e) =>
          e.status === "encerrada" &&
          data.entries.some((en) => en.editionId === e.id && en.result),
      ) ?? null;
  let finish: number[] = [];
  if (previous) {
    const prevEntries = data.entries.filter((e) => e.editionId === previous.id);
    const table = computeStandings(
      prevEntries,
      data.matches.filter((m) => m.editionId === previous.id),
    );
    const campaign = new Map(table.map((row, i) => [row.entryId, i]));
    finish = [...prevEntries]
      .sort(
        (a, b) =>
          resultRank(a.result) - resultRank(b.result) ||
          (campaign.get(a.id) ?? 0) - (campaign.get(b.id) ?? 0) ||
          a.seed - b.seed,
      )
      .map((e) => e.playerId);
  }
  const participants = data.entries.filter((e) => e.editionId === editionId);
  return { previous, order: turnOrder(participants, finish) };
}

async function choiceContext(db: Db, editionId: number) {
  const edition = await getEdition(db, editionId);
  if (!edition.useTeams)
    throw new UserError("Esta edição é só com os jogadores, sem times.");
  if (edition.status !== "inscricoes")
    throw new UserError(
      "A escolha dos times só pode ser feita antes de gerar a tabela.",
    );
  const { order: playerIds } = choiceTurnOrder(await loadAll(db), editionId);
  const state = choiceState(playerIds, await listTeamChoices(db, editionId));
  return { playerIds, state };
}

/** Recusa quem tenta jogar fora da vez. */
async function requireTurn(
  db: Db,
  state: ReturnType<typeof choiceState>,
  playerId: number,
) {
  if (state.turn != null && state.turn !== playerId)
    throw new UserError(`Agora é a vez de ${await playerName(db, state.turn)}.`);
}

async function playerName(db: Db, playerId: number) {
  const [row] = await db
    .select({ name: players.name })
    .from(players)
    .where(eq(players.id, playerId));
  return row?.name ?? "outro jogador";
}

/** Com todos os banimentos feitos, os times que sobraram vão para o sorteio. */
async function syncChoicePool(db: Db, editionId: number) {
  const { state } = await choiceContext(db, editionId);
  if (state.phase !== "sorteio" || state.draws.length > 0) return;
  await db
    .update(editions)
    .set({ teamPool: cleanTeamList(state.remaining) })
    .where(eq(editions.id, editionId));
}

/** Um jogador cita um time (cada um cita PICKS_PER_PLAYER, sem repetir). */
export async function addTeamPick(
  db: Db,
  editionId: number,
  playerId: number,
  rawTeam: unknown,
) {
  const { playerIds, state } = await choiceContext(db, editionId);
  if (playerIds.length < 2)
    throw new UserError("Adicione pelo menos 2 participantes antes.");
  if (!playerIds.includes(playerId))
    throw new UserError("Esse jogador não está nesta edição.");
  if (state.phase !== "escolha")
    throw new UserError("Todos já citaram seus times. Agora é o banimento.");
  await requireTurn(db, state, playerId);
  let team = clean(rawTeam, 60);
  if (!team) throw new UserError("Informe o time.");
  // Usa a grafia do time já cadastrado, se houver.
  const known = (await db.select().from(teams)).find(
    (t) => foldTeam(t.name) === foldTeam(team),
  );
  if (known) team = known.name;
  if (state.picks.filter((p) => p.playerId === playerId).length >= PICKS_PER_PLAYER)
    throw new UserError(
      `${await playerName(db, playerId)} já citou ${PICKS_PER_PLAYER} times.`,
    );
  const taken = state.picks.find((p) => foldTeam(p.team) === foldTeam(team));
  if (taken)
    throw new UserError(
      taken.playerId === playerId
        ? `${taken.team} já está na lista dele.`
        : `${taken.team} já foi citado por ${await playerName(db, taken.playerId)}.`,
    );
  await db
    .insert(teamChoices)
    .values({ editionId, playerId, kind: "escolha", team });
  await syncChoicePool(db, editionId);
}

/** Um jogador bane um dos times citados (cada um bane BANS_PER_PLAYER). */
export async function banTeam(
  db: Db,
  editionId: number,
  playerId: number,
  rawTeam: unknown,
) {
  const { playerIds, state } = await choiceContext(db, editionId);
  if (!playerIds.includes(playerId))
    throw new UserError("Esse jogador não está nesta edição.");
  if (state.phase === "escolha")
    throw new UserError("O banimento começa quando todos citarem seus times.");
  if (state.phase !== "banimento")
    throw new UserError("Todos já baniram. Os times estão definidos.");
  await requireTurn(db, state, playerId);
  if (state.bans.filter((b) => b.playerId === playerId).length >= BANS_PER_PLAYER)
    throw new UserError(`${await playerName(db, playerId)} já baniu um time.`);
  const pick = state.picks.find(
    (p) => foldTeam(p.team) === foldTeam(clean(rawTeam, 60)),
  );
  if (!pick) throw new UserError("Escolha um dos times citados.");
  const by = state.bannedBy.get(foldTeam(pick.team));
  if (by != null)
    throw new UserError(
      `${pick.team} já foi banido por ${await playerName(db, by)}.`,
    );
  await db
    .insert(teamChoices)
    .values({ editionId, playerId, kind: "veto", team: pick.team });
  await syncChoicePool(db, editionId);
}

/** Desfaz uma escolha ou um banimento lançado errado. */
export async function removeTeamChoice(db: Db, choiceId: number) {
  const [row] = await db
    .select()
    .from(teamChoices)
    .where(eq(teamChoices.id, choiceId));
  if (!row) throw new UserError("Essa escolha já foi desfeita.");
  const { state } = await choiceContext(db, row.editionId);
  if (row.kind === "sorteio")
    throw new UserError("Para mudar o sorteio, use Refazer sorteio.");
  if (state.draws.length > 0)
    throw new UserError(
      "O sorteio já começou. Refaça o sorteio antes de mudar os times.",
    );
  if (row.kind === "escolha" && state.bans.length > 0)
    throw new UserError(
      "O banimento já começou. Desfaça os banimentos antes de trocar um time citado.",
    );
  await db.delete(teamChoices).where(eq(teamChoices.id, choiceId));
}

/** Apaga todas as escolhas, banimentos e o sorteio da edição, para começar de novo. */
export async function resetTeamChoices(db: Db, editionId: number) {
  const { state } = await choiceContext(db, editionId);
  await db.transaction(async (tx) => {
    if (state.draws.length > 0) await clearEditionTeams(tx, editionId);
    await tx.delete(teamChoices).where(eq(teamChoices.editionId, editionId));
  });
}

/** Tira o time de todos os participantes da edição. */
async function clearEditionTeams(db: Db, editionId: number) {
  await db
    .update(entries)
    .set({ teamId: null })
    .where(eq(entries.editionId, editionId));
}

/**
 * Sorteia os times de todos os jogadores que ainda estão sem time, em ordem
 * aleatória. Cada sorteio fica gravado na ordem em que saiu, para a TV revelar
 * um por um. No primeiro sorteio, os times que os participantes tinham antes
 * são apagados.
 */
export async function drawRemainingTeams(db: Db, editionId: number) {
  const { playerIds, state } = await choiceContext(db, editionId);
  if (state.phase === "escolha" || state.phase === "banimento")
    throw new UserError("O sorteio começa depois dos banimentos.");
  if (state.phase === "concluida")
    throw new UserError("Todos os times já foram sorteados.");
  const drawnPlayers = new Set(state.draws.map((d) => d.playerId));
  const waiting = shuffle(playerIds.filter((id) => !drawnPlayers.has(id)));
  const pool = shuffle(state.undrawn);
  return db.transaction(async (tx) => {
    if (state.draws.length === 0) await clearEditionTeams(tx, editionId);
    const out: { playerId: number; team: string }[] = [];
    for (const [i, playerId] of waiting.entries()) {
      const team = await ensureTeam(tx, pool[i]);
      await tx
        .update(entries)
        .set({ teamId: team.id })
        .where(
          and(eq(entries.editionId, editionId), eq(entries.playerId, playerId)),
        );
      await tx
        .insert(teamChoices)
        .values({ editionId, playerId, kind: "sorteio", team: team.name });
      out.push({ playerId, team: team.name });
    }
    return out;
  });
}

/**
 * O botão do sorteio na escolha dos times: sorteia os times e, nas edições
 * com grupos, já sorteia os grupos e gera a tabela (a TV mostra os dois, um
 * depois do outro). O formato é conferido antes, para não parar no meio.
 */
export async function drawChoiceTeams(db: Db, editionId: number) {
  const edition = await getEdition(db, editionId);
  const withGroups = edition.format === "grupos";
  if (withGroups) {
    const count = (
      await db.select().from(entries).where(eq(entries.editionId, editionId))
    ).length;
    const problem = validateConfig(configOf(edition), count);
    if (problem) throw new UserError(problem);
  }
  const drawn = await drawRemainingTeams(db, editionId);
  if (withGroups) await startEdition(db, editionId);
  return drawn;
}

/** Desfaz o sorteio dos times (as escolhas e os banimentos continuam). */
export async function resetTeamDraw(db: Db, editionId: number) {
  await choiceContext(db, editionId);
  await db.transaction(async (tx) => {
    await clearEditionTeams(tx, editionId);
    await tx
      .delete(teamChoices)
      .where(
        and(
          eq(teamChoices.editionId, editionId),
          eq(teamChoices.kind, "sorteio"),
        ),
      );
  });
}

async function getEntry(db: Db, entryId: number) {
  const [entry] = await db
    .select()
    .from(entries)
    .where(eq(entries.id, entryId));
  if (!entry) throw new UserError("Participante não encontrado.");
  return entry;
}

/** Define (ou remove) manualmente o time de um participante. */
export async function setEntryTeam(db: Db, entryId: number, teamName: unknown) {
  const entry = await getEntry(db, entryId);
  const name = clean(teamName, 60);
  if (!name) {
    await db
      .update(entries)
      .set({ teamId: null })
      .where(eq(entries.id, entryId));
    return;
  }
  if (!(await getEdition(db, entry.editionId)).useTeams)
    throw new UserError("Esta edição é só com os jogadores, sem times.");
  const team = await ensureTeam(db, name);
  const siblings = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, entry.editionId));
  if (siblings.some((e) => e.id !== entryId && e.teamId === team.id))
    throw new UserError(`${team.name} já está com outro participante.`);
  await db
    .update(entries)
    .set({ teamId: team.id })
    .where(eq(entries.id, entryId));
}

/**
 * Junta dois times (por exemplo, um nome digitado errado): os participantes e
 * as listas de sorteio do time `fromId` passam para o `intoId`, e o `fromId`
 * deixa de existir. Recusa se os dois estiverem com participantes diferentes
 * na mesma edição.
 */
export async function mergeTeams(db: Db, fromId: number, intoId: number) {
  if (fromId === intoId) throw new UserError("Escolha dois times diferentes.");
  const [from] = await db.select().from(teams).where(eq(teams.id, fromId));
  const [into] = await db.select().from(teams).where(eq(teams.id, intoId));
  if (!from || !into) throw new UserError("Time não encontrado.");

  const used = await db
    .select({ editionId: entries.editionId, teamId: entries.teamId })
    .from(entries)
    .where(inArray(entries.teamId, [fromId, intoId]));
  const clash = used.find(
    (a) =>
      a.teamId === fromId &&
      used.some((b) => b.teamId === intoId && b.editionId === a.editionId),
  );
  if (clash) {
    const [edition] = await db
      .select({ name: editions.name })
      .from(editions)
      .where(eq(editions.id, clash.editionId));
    throw new UserError(
      `${from.name} e ${into.name} estão com participantes diferentes na ${edition?.name ?? "mesma edição"}. Ajuste um deles antes de juntar.`,
    );
  }

  const fold = (s: string) => s.toLocaleLowerCase("pt-BR");
  const allEditions = await db.select().from(editions);
  await db.transaction(async (tx) => {
    await tx
      .update(entries)
      .set({ teamId: intoId })
      .where(eq(entries.teamId, fromId));
    for (const edition of allEditions) {
      const pool = edition.teamPool ?? [];
      if (!pool.some((t) => fold(t) === fold(from.name))) continue;
      const next: string[] = [];
      for (const t of pool) {
        const name = fold(t) === fold(from.name) ? into.name : t;
        if (!next.some((n) => fold(n) === fold(name))) next.push(name);
      }
      await tx
        .update(editions)
        .set({ teamPool: next })
        .where(eq(editions.id, edition.id));
    }
    if (!into.badgeUrl && from.badgeUrl) {
      await tx
        .update(teams)
        .set({ badgeUrl: from.badgeUrl })
        .where(eq(teams.id, intoId));
      await tx.delete(teamBadges).where(eq(teamBadges.teamId, intoId));
      await tx
        .update(teamBadges)
        .set({ teamId: intoId })
        .where(eq(teamBadges.teamId, fromId));
    }
    await tx.delete(teamBadges).where(eq(teamBadges.teamId, fromId));
    await tx.delete(teams).where(eq(teams.id, fromId));
  });
  return { from: from.name, into: into.name };
}

/** Troca o nome de um time em todo lugar (participantes e listas de sorteio). */
export async function renameTeam(db: Db, id: number, rawName: unknown) {
  const name = clean(rawName, 60);
  if (!name) throw new UserError("Informe o nome do time.");
  const all = await db.select().from(teams);
  const team = all.find((t) => t.id === id);
  if (!team) throw new UserError("Time não encontrado.");
  const other = all.find((t) => t.id !== id && sameName(t.name, name));
  if (other)
    throw new UserError(
      `Já existe o time ${other.name}. Para unir os dois, use "Juntar times".`,
    );
  if (team.name === name) return;
  const allEditions = await db.select().from(editions);
  await db.transaction(async (tx) => {
    await tx.update(teams).set({ name }).where(eq(teams.id, id));
    for (const edition of allEditions) {
      const pool = edition.teamPool ?? [];
      if (!pool.some((t) => sameName(t, team.name))) continue;
      await tx
        .update(editions)
        .set({
          teamPool: cleanTeamList(
            pool.map((t) => (sameName(t, team.name) ? name : t)),
          ),
        })
        .where(eq(editions.id, edition.id));
    }
  });
}

/** Apaga um time que nenhum participante usa. */
export async function deleteTeam(db: Db, id: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, id));
  if (!team) throw new UserError("Time não encontrado.");
  const [inUse] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.teamId, id))
    .limit(1);
  if (inUse)
    throw new UserError(
      `${team.name} já foi usado por participantes e não pode ser apagado. Dá para renomear ou juntar com outro.`,
    );
  await db.delete(teamBadges).where(eq(teamBadges.teamId, id));
  await db.delete(teams).where(eq(teams.id, id));
}

// ---------------------------------------------------------------------------
// Escudos

/** Define (ou tira, com texto vazio) o link do escudo de um time. */
export async function setTeamBadge(db: Db, id: number, rawUrl: unknown) {
  const url = clean(rawUrl, 500);
  if (url && !/^https:\/\/[^\s]+$/i.test(url))
    throw new UserError("O link do escudo precisa começar com https://");
  const [team] = await db.select().from(teams).where(eq(teams.id, id));
  if (!team) throw new UserError("Time não encontrado.");
  if (!url) {
    await db.delete(teamBadges).where(eq(teamBadges.teamId, id));
    await db.update(teams).set({ badgeUrl: null }).where(eq(teams.id, id));
    return;
  }
  await storeBadge(db, id, url);
}

/** Baixa a imagem e guarda junto com o link (o link só vale se a imagem veio). */
async function storeBadge(db: Db, teamId: number, url: string) {
  let image: { contentType: string; data: string };
  try {
    image = await downloadBadge(url);
  } catch (err) {
    if (err instanceof ApiFootballError) throw new UserError(err.message);
    throw err;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(teamBadges)
      .values({ teamId, ...image, sourceUrl: url })
      .onConflictDoUpdate({
        target: teamBadges.teamId,
        set: { ...image, sourceUrl: url, updatedAt: sql`CURRENT_TIMESTAMP` },
      });
    await tx.update(teams).set({ badgeUrl: url }).where(eq(teams.id, teamId));
  });
}

/**
 * Imagem guardada do escudo. Times que só têm o link (salvos antes de as
 * imagens irem para o banco) têm a imagem baixada e guardada na primeira vez.
 */
export async function getTeamBadge(db: Db, teamId: number) {
  const [row] = await db.select().from(teamBadges).where(eq(teamBadges.teamId, teamId));
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team?.badgeUrl) return null;
  if (row && row.sourceUrl === team.badgeUrl)
    return { contentType: row.contentType, data: row.data };
  try {
    await storeBadge(db, teamId, team.badgeUrl);
  } catch {
    return null;
  }
  const [fresh] = await db.select().from(teamBadges).where(eq(teamBadges.teamId, teamId));
  return fresh ? { contentType: fresh.contentType, data: fresh.data } : null;
}

/** Procura escudos para um time na API-Football (1 consulta). */
export async function searchTeamBadges(db: Db, id: number, rawTerm: unknown) {
  const [team] = await db.select().from(teams).where(eq(teams.id, id));
  if (!team) throw new UserError("Time não encontrado.");
  const term = clean(rawTerm, 60) || team.name;
  const found = await searchTeams(term);
  return rankCandidates(team.name, found).slice(0, 8);
}

const CATALOG = catalog as Record<string, string[]>;

/**
 * Preenche os escudos que faltam nos times de uma liga do catálogo com uma
 * única consulta (a lista de times da liga). Se o plano não liberar a
 * temporada atual, tenta as anteriores (maxSeason evita repetir as tentativas
 * que já falharam em outra liga). Times da liga que já têm escudo, ou que nem
 * estão cadastrados, não gastam consulta.
 */
export async function fillLeagueBadges(
  db: Db,
  league: string,
  maxSeason?: number,
): Promise<{ matched: string[]; missing: string[]; season?: number; calls: number }> {
  const info = LEAGUES[league];
  if (!info || !CATALOG[league]) throw new UserError("Liga desconhecida.");
  const pending = (await db.select().from(teams)).filter(
    (t) => !t.badgeUrl && catalogLeague(t.name) === league,
  );
  if (pending.length === 0)
    return { matched: [], missing: [], season: maxSeason, calls: 0 };

  const countries = leagueCountries(league);
  let year = Math.min(currentSeason(league), maxSeason ?? Infinity);
  let calls = 0;
  let list: Awaited<ReturnType<typeof leagueTeams>> = [];
  for (;;) {
    calls++;
    try {
      list = await leagueTeams(info.id, year);
      break;
    } catch (err) {
      // Plano grátis: só algumas temporadas antigas. Desce um ano e tenta de novo.
      if (err instanceof ApiFootballError && err.problem === "temporada" && year > 2021) {
        year--;
        continue;
      }
      throw err;
    }
  }
  list = list.filter((c) => countries.includes(c.country));

  const matched: string[] = [];
  const missing: string[] = [];
  for (const team of pending) {
    const hit = bestMatch(team.name, list);
    if (!hit) {
      missing.push(team.name);
      continue;
    }
    try {
      await storeBadge(db, team.id, hit.logo);
    } catch {
      // Achou na API, mas a imagem não veio: fica para a busca individual.
      missing.push(team.name);
      continue;
    }
    matched.push(team.name);
  }
  return { matched, missing, season: year, calls };
}

/** Ligas do catálogo e quantos times cadastrados de cada uma estão sem escudo. */
export function badgeCoverage(list: Team[]) {
  return Object.keys(LEAGUES).map((league) => {
    const ours = list.filter((t) => catalogLeague(t.name) === league);
    return {
      league,
      teams: ours.length,
      missing: ours.filter((t) => !t.badgeUrl).length,
    };
  });
}

/**
 * Apaga os times que nenhum participante usa (nomes que só ficaram na lista
 * de sorteio ou que foram trocados). Devolve os nomes apagados.
 */
export async function deleteUnusedTeams(db: Db) {
  const used = new Set(
    (await db.select({ teamId: entries.teamId }).from(entries))
      .map((e) => e.teamId)
      .filter((id): id is number => id != null),
  );
  const unused = (await db.select().from(teams)).filter((t) => !used.has(t.id));
  if (unused.length === 0) return [];
  await db.delete(teamBadges).where(
    inArray(
      teamBadges.teamId,
      unused.map((t) => t.id),
    ),
  );
  await db.delete(teams).where(
    inArray(
      teams.id,
      unused.map((t) => t.id),
    ),
  );
  return unused.map((t) => t.name).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface DrawAssignment {
  entryId: number;
  playerName: string;
  teamName: string;
}

/** Sorteia um time da lista para cada participante. */
export async function drawTeams(
  db: Db,
  editionId: number,
): Promise<DrawAssignment[]> {
  const edition = await getEdition(db, editionId);
  if (!edition.useTeams)
    throw new UserError("Esta edição é só com os jogadores, sem times.");
  if (edition.status !== "inscricoes")
    throw new UserError("O sorteio só pode ser feito antes de gerar a tabela.");
  const rows = await db
    .select({ entry: entries, player: players })
    .from(entries)
    .innerJoin(players, eq(entries.playerId, players.id))
    .where(eq(entries.editionId, editionId));
  if (rows.length < 2)
    throw new UserError(
      "Adicione pelo menos 2 participantes antes de sortear.",
    );
  if (edition.teamPool.length < rows.length)
    throw new UserError(
      `Faltam times para o sorteio: são ${rows.length} participantes e ${edition.teamPool.length} times na lista.`,
    );

  const pool = shuffle(edition.teamPool);
  const order = shuffle(rows);
  return db.transaction(async (tx) => {
    const out: DrawAssignment[] = [];
    for (const [i, row] of order.entries()) {
      const team = await ensureTeam(tx, pool[i]);
      await tx
        .update(entries)
        .set({ teamId: team.id })
        .where(eq(entries.id, row.entry.id));
      out.push({
        entryId: row.entry.id,
        playerName: row.player.name,
        teamName: team.name,
      });
    }
    return out;
  });
}

export interface GroupDrawItem {
  entryId: number;
  playerName: string;
  avatar: AvatarLook | null;
  teamName: string | null;
  groupLabel: string | null;
  /** Campeão da edição anterior: entra no sorteio carregando o troféu. */
  champion: boolean;
}

/**
 * Jogador campeão da edição anterior (a de número mais alto antes desta que
 * tem campeão definido), ou null se ainda não houver.
 */
export async function defendingChampionId(
  db: Db,
  editionId: number,
): Promise<number | null> {
  const edition = await getEdition(db, editionId);
  const rows = await db
    .select({ playerId: entries.playerId, number: editions.number })
    .from(entries)
    .innerJoin(editions, eq(entries.editionId, editions.id))
    .where(and(eq(entries.result, "campeao"), ne(editions.id, editionId)));
  return latestChampionBefore(rows, edition.number);
}

function latestChampionBefore(
  champions: { playerId: number; number: number }[],
  number: number,
): number | null {
  const before = champions
    .filter((r) => r.number < number)
    .sort((a, b) => b.number - a.number);
  return before[0]?.playerId ?? null;
}

/**
 * O sorteio dos grupos de uma edição já começada, na ordem em que saiu, para
 * rever a animação. Null se a edição não tem grupos ou ainda não foi sorteada.
 */
export function drawReplay(data: AllData, editionId: number): GroupDrawItem[] | null {
  const edition = data.editions.find((e) => e.id === editionId);
  if (!edition || edition.format !== "grupos" || edition.status === "inscricoes")
    return null;
  const list = data.entries
    .filter((e) => e.editionId === editionId)
    .sort((a, b) => a.seed - b.seed || a.id - b.id);
  if (!list.length || list.some((e) => !e.groupLabel)) return null;
  const editionNumber = new Map(data.editions.map((e) => [e.id, e.number]));
  const championId = latestChampionBefore(
    data.entries
      .filter((e) => e.result === "campeao" && e.editionId !== editionId)
      .map((e) => ({ playerId: e.playerId, number: editionNumber.get(e.editionId) ?? 0 })),
    edition.number,
  );
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  return list.map((e) => ({
    entryId: e.id,
    playerName: playerById.get(e.playerId)?.name ?? "",
    avatar: parseAvatar(playerById.get(e.playerId)?.avatar ?? null),
    teamName: e.teamId != null ? (teamById.get(e.teamId)?.name ?? null) : null,
    groupLabel: e.groupLabel,
    champion: championId != null && e.playerId === championId,
  }));
}

interface Seeded {
  id: number;
  seed: number;
  groupLabel: string | null;
}

/**
 * Grava a ordem e os grupos dos participantes, apaga os jogos que existiam e
 * gera a tabela de novo. Placares e colocações são zerados.
 */
async function applyPlan(
  tx: Db,
  editionId: number,
  config: FormatConfig,
  seeded: Seeded[],
) {
  const planned = planMatches(config, seeded);
  for (const e of seeded) {
    await tx
      .update(entries)
      .set({ seed: e.seed, groupLabel: e.groupLabel, result: null })
      .where(eq(entries.id, e.id));
  }
  await tx.delete(matches).where(eq(matches.editionId, editionId));
  if (planned.length) {
    await tx.insert(matches).values(planned.map((m) => ({ ...m, editionId })));
  }
  await tx
    .update(editions)
    .set({ status: "andamento" })
    .where(eq(editions.id, editionId));
}

/** Quantos participantes há em cada grupo, na ordem A, B, C... */
function countByGroup(labels: (string | null)[], groups: number) {
  return GROUP_LABELS.slice(0, groups).map(
    (label) => labels.filter((l) => l === label).length,
  );
}

/**
 * Sorteia grupos/chaves e gera todos os jogos. Se os grupos já foram definidos
 * à mão (todos os participantes com grupo), usa esses grupos. Devolve os
 * participantes na ordem em que foram sorteados, para a tela mostrar o sorteio.
 */
export async function startEdition(
  db: Db,
  editionId: number,
): Promise<GroupDrawItem[]> {
  const edition = await getEdition(db, editionId);
  if (edition.format === "manual")
    throw new UserError(
      "Edições de registro histórico não têm tabela de jogos.",
    );
  if (edition.status !== "inscricoes")
    throw new UserError("A tabela desta edição já foi gerada.");
  const config = configOf(edition);
  const current = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, editionId));
  const problem = validateConfig(config, current.length);
  if (problem) throw new UserError(problem);
  if (edition.useTeams && current.some((e) => e.teamId == null))
    throw new UserError(
      "Ainda há participantes sem time. Faça o sorteio primeiro.",
    );

  let seeded: Seeded[];
  if (config.format === "grupos" && current.some((e) => e.groupLabel)) {
    // Grupos definidos à mão: é tudo ou nada.
    if (current.some((e) => !e.groupLabel))
      throw new UserError(
        "Defina o grupo de todos os participantes, ou de nenhum para sortear.",
      );
    const sizeProblem = validateGroupSizes(
      config,
      countByGroup(
        current.map((e) => e.groupLabel),
        config.groupsCount,
      ),
    );
    if (sizeProblem) throw new UserError(sizeProblem);
    seeded = shuffle(current).map((e, seed) => ({
      id: e.id,
      seed,
      groupLabel: e.groupLabel,
    }));
  } else {
    const order = shuffle(current.map((e) => e.id));
    const groups =
      config.format === "grupos"
        ? assignGroups(order, config.groupsCount)
        : order.map((id) => ({
            id,
            groupLabel: config.format === "liga" ? "A" : null,
          }));
    seeded = groups.map((g, seed) => ({ ...g, seed }));
  }

  await db.transaction((tx) => applyPlan(tx, editionId, config, seeded));

  const names = await db
    .select({
      entryId: entries.id,
      playerId: entries.playerId,
      playerName: players.name,
      avatar: players.avatar,
      teamName: teams.name,
    })
    .from(entries)
    .innerJoin(players, eq(entries.playerId, players.id))
    .leftJoin(teams, eq(entries.teamId, teams.id))
    .where(eq(entries.editionId, editionId));
  const byEntry = new Map(names.map((n) => [n.entryId, n]));
  const championId = await defendingChampionId(db, editionId);
  return seeded.map((e) => ({
    entryId: e.id,
    playerName: byEntry.get(e.id)?.playerName ?? "",
    avatar: byEntry.get(e.id)?.avatar ?? null,
    teamName: byEntry.get(e.id)?.teamName ?? null,
    groupLabel: e.groupLabel,
    champion: championId != null && byEntry.get(e.id)?.playerId === championId,
  }));
}

export interface GroupAssignment {
  entryId: number;
  /** null = sem grupo (só vale antes de gerar a tabela). */
  groupLabel: string | null;
}

/**
 * Coloca participantes nos grupos à mão. Antes de gerar a tabela só guarda os
 * grupos (a geração usa os que estiverem definidos). Com a tabela já gerada,
 * exige todos com grupo e refaz as rodadas, apagando os placares.
 */
export async function setEntryGroups(
  db: Db,
  editionId: number,
  assignments: GroupAssignment[],
) {
  const edition = await getEdition(db, editionId);
  if (edition.format !== "grupos")
    throw new UserError("Só edições com grupos têm grupos para ajustar.");
  const config = configOf(edition);
  const valid = new Set(GROUP_LABELS.slice(0, config.groupsCount));
  const current = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, editionId));
  const byId = new Map(current.map((e) => [e.id, e]));

  const labels = new Map<number, string | null>(
    current.map((e) => [e.id, e.groupLabel]),
  );
  for (const a of assignments) {
    if (!byId.has(a.entryId))
      throw new UserError("Participante não encontrado nesta edição.");
    if (a.groupLabel != null && !valid.has(a.groupLabel))
      throw new UserError("Grupo inválido.");
    labels.set(a.entryId, a.groupLabel);
  }

  if (edition.status === "inscricoes") {
    await db.transaction(async (tx) => {
      for (const [id, groupLabel] of labels) {
        await tx.update(entries).set({ groupLabel }).where(eq(entries.id, id));
      }
    });
    return;
  }

  if ([...labels.values()].some((l) => l == null))
    throw new UserError("Todos os participantes precisam estar em um grupo.");
  const problem = validateGroupSizes(
    config,
    countByGroup([...labels.values()], config.groupsCount),
  );
  if (problem) throw new UserError(problem);
  const seeded = [...current]
    .sort((a, b) => a.seed - b.seed)
    .map((e, seed) => ({ id: e.id, seed, groupLabel: labels.get(e.id)! }));
  await db.transaction((tx) => applyPlan(tx, editionId, config, seeded));
}

/**
 * Gera as rodadas de novo, mantendo os grupos: embaralha a ordem dos
 * participantes (e com ela os confrontos de cada rodada) e apaga os placares.
 */
export async function regenerateMatches(db: Db, editionId: number) {
  const edition = await getEdition(db, editionId);
  if (edition.format === "manual")
    throw new UserError("Edições de registro histórico não têm rodadas.");
  if (edition.status === "inscricoes")
    throw new UserError("Gere a tabela antes de gerar as rodadas de novo.");
  const config = configOf(edition);
  const current = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, editionId));
  const seeded = shuffle(current).map((e, seed) => ({
    id: e.id,
    seed,
    groupLabel: e.groupLabel,
  }));
  await db.transaction((tx) => applyPlan(tx, editionId, config, seeded));
}

/**
 * Muda quantos avançam para o mata-mata (ou seja, quantas fases ele tem) e se
 * há disputa de 3º lugar, mesmo com a copa em andamento. Os jogos da fase de
 * grupos (ou dos pontos corridos) e os placares deles são mantidos; o
 * mata-mata é refeito do zero, então os placares dele são apagados.
 */
export async function setKnockoutPhases(
  db: Db,
  editionId: number,
  input: { qualifiers: number; thirdPlace: boolean; playoffs?: number },
) {
  const edition = await getEdition(db, editionId);
  if (edition.format !== "grupos" && edition.format !== "liga")
    throw new UserError(
      "Só edições com grupos ou pontos corridos podem mudar as fases do mata-mata.",
    );
  if (edition.status === "inscricoes")
    throw new UserError(
      'Antes de gerar a tabela, mude as fases em "Dados e formato".',
    );
  const qualifiers = Number(input.qualifiers);
  if (!Number.isInteger(qualifiers) || qualifiers < 0)
    throw new UserError("Quantidade de classificados inválida.");
  const config: FormatConfig = normalizeConfig({
    ...configOf(edition),
    qualifiers,
    thirdPlace: Boolean(input.thirdPlace),
    playoffs: Number(input.playoffs) || 0,
  });

  const current = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, editionId));
  const problem =
    config.format === "grupos"
      ? validateGroupSizes(
          config,
          countByGroup(
            current.map((e) => e.groupLabel),
            config.groupsCount,
          ),
        )
      : validateConfig(config, current.length);
  if (problem) throw new UserError(problem);

  const knockout = planMatches(config, current).filter(
    (m) => m.stage !== "grupo",
  );
  await db.transaction(async (tx) => {
    await tx
      .delete(matches)
      .where(and(eq(matches.editionId, editionId), ne(matches.stage, "grupo")));
    await tx
      .update(editions)
      .set({
        qualifiers,
        thirdPlace: config.thirdPlace,
        playoffs: config.playoffs ?? 0,
      })
      .where(eq(editions.id, editionId));
    await tx
      .update(entries)
      .set({ result: null })
      .where(eq(entries.editionId, editionId));
    if (knockout.length) {
      await tx
        .insert(matches)
        .values(knockout.map((m) => ({ ...m, editionId })));
    }
    // Resolve quem entra em cada vaga com a classificação atual dos grupos.
    await tx
      .update(editions)
      .set({ status: "andamento" })
      .where(eq(editions.id, editionId));
    await syncEdition(tx, editionId);
  });
}

export interface KnockoutSlotInput {
  matchId: number;
  side: "home" | "away";
  /** null = deixa a vaga como está. */
  entryId: number | null;
}

/**
 * Escolhe à mão quem joga cada confronto do mata-mata. Só vagas que não vêm
 * do vencedor de outro jogo podem ser mudadas. Uma vaga escolhida deixa de
 * seguir a classificação dos grupos. Quem muda de confronto tem o placar
 * apagado, e os jogos seguintes são refeitos.
 */
export async function setKnockoutSlots(
  db: Db,
  editionId: number,
  slots: KnockoutSlotInput[],
) {
  const edition = await getEdition(db, editionId);
  if (edition.format === "manual" || edition.status === "inscricoes")
    throw new UserError("Gere a tabela antes de editar o mata-mata.");

  await db.transaction(async (tx) => {
    const [entryRows, matchRows] = await Promise.all([
      tx.select().from(entries).where(eq(entries.editionId, editionId)),
      tx.select().from(matches).where(eq(matches.editionId, editionId)),
    ]);
    const entryIds = new Set(entryRows.map((e) => e.id));
    const matchById = new Map(matchRows.map((m) => [m.id, m]));

    // Só o que realmente mudou é gravado: o resto continua seguindo as regras.
    const changes = new Map<number, Partial<typeof matches.$inferInsert>>();
    for (const slot of slots) {
      if (slot.entryId == null) continue;
      const match = matchById.get(slot.matchId);
      if (!match || (match.stage !== "mata" && match.stage !== "repescagem"))
        throw new UserError("Confronto não encontrado no mata-mata.");
      if (!entryIds.has(slot.entryId))
        throw new UserError("Participante não encontrado nesta edição.");
      const home = slot.side === "home";
      if (
        !isEditableSlot(
          home ? match.homeSource : match.awaySource,
          match.round,
          knockoutRounds(matchRows),
        )
      )
        throw new UserError(
          "Essa vaga é decidida pelo resultado de outro jogo e não pode ser editada.",
        );
      if ((home ? match.homeEntryId : match.awayEntryId) === slot.entryId)
        continue;
      const change = changes.get(match.id) ?? {
        homeScore: null,
        awayScore: null,
        homePens: null,
        awayPens: null,
        playedAt: null,
      };
      if (home)
        Object.assign(change, { homeEntryId: slot.entryId, homeSource: null });
      else
        Object.assign(change, { awayEntryId: slot.entryId, awaySource: null });
      changes.set(match.id, change);
    }
    if (changes.size === 0) return;

    for (const [matchId, change] of changes) {
      await tx.update(matches).set(change).where(eq(matches.id, matchId));
    }
    await syncEdition(tx, editionId);

    // Depois de refazer tudo: ninguém joga duas vezes na mesma fase, nem contra si.
    const after = await tx
      .select()
      .from(matches)
      .where(eq(matches.editionId, editionId));
    const seen = new Set<string>();
    for (const m of after.filter(
      (x) => x.stage === "mata" || x.stage === "repescagem",
    )) {
      if (m.homeEntryId != null && m.homeEntryId === m.awayEntryId)
        throw new UserError("Um participante não pode jogar contra ele mesmo.");
      for (const id of [m.homeEntryId, m.awayEntryId]) {
        if (id == null) continue;
        const key = `${m.stage}:${m.round}:${id}`;
        if (seen.has(key))
          throw new UserError(
            "O mesmo participante não pode estar em dois confrontos da mesma fase. Troque os dois lados.",
          );
        seen.add(key);
      }
    }
    // Quem já tem vaga direta no mata-mata não joga a repescagem (se vencesse,
    // ocuparia duas vagas).
    const direct = new Set<number>();
    for (const m of after.filter((x) => x.stage === "mata" && x.round === 1)) {
      if (m.homeEntryId != null && !m.homeSource?.startsWith("P:"))
        direct.add(m.homeEntryId);
      if (m.awayEntryId != null && !m.awaySource?.startsWith("P:"))
        direct.add(m.awayEntryId);
    }
    for (const m of after.filter((x) => x.stage === "repescagem")) {
      if (
        (m.homeEntryId != null && direct.has(m.homeEntryId)) ||
        (m.awayEntryId != null && direct.has(m.awayEntryId))
      )
        throw new UserError(
          "Quem já tem vaga direta no mata-mata não pode jogar a repescagem.",
        );
    }
  });
}

/** Apaga a tabela de jogos e volta a edição para a fase de inscrições. */
export async function resetEdition(db: Db, editionId: number) {
  const edition = await getEdition(db, editionId);
  if (edition.format === "manual") return;
  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.editionId, editionId));
    await tx
      .update(entries)
      .set({ groupLabel: null, result: null })
      .where(eq(entries.editionId, editionId));
    await tx
      .update(editions)
      .set({ status: "inscricoes" })
      .where(eq(editions.id, editionId));
  });
}

export async function deleteEdition(db: Db, editionId: number) {
  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.editionId, editionId));
    await tx.delete(entries).where(eq(entries.editionId, editionId));
    await tx.delete(editions).where(eq(editions.id, editionId));
  });
}

// ---------------------------------------------------------------------------
// Resultados

/** Recalcula o mata-mata, as colocações e o status depois de qualquer mudança. */
export async function syncEdition(db: Db, editionId: number) {
  const edition = await getEdition(db, editionId);
  if (edition.format === "manual") return;
  const [entryRows, matchRows] = await Promise.all([
    db.select().from(entries).where(eq(entries.editionId, editionId)),
    db.select().from(matches).where(eq(matches.editionId, editionId)),
  ]);

  const { changes, matches: resolved } = resolveKnockout(entryRows, matchRows);
  for (const c of changes) {
    await db
      .update(matches)
      .set({
        homeEntryId: c.homeEntryId,
        awayEntryId: c.awayEntryId,
        ...(c.clearScore
          ? {
              homeScore: null,
              awayScore: null,
              homePens: null,
              awayPens: null,
              playedAt: null,
            }
          : {}),
      })
      .where(eq(matches.id, c.id));
  }

  const { finished, results } = computeResults(
    configOf(edition),
    entryRows,
    resolved,
  );
  for (const e of entryRows) {
    const result = finished ? (results.get(e.id) ?? null) : null;
    if (result !== e.result) {
      await db.update(entries).set({ result }).where(eq(entries.id, e.id));
    }
  }
  const status =
    matchRows.length === 0
      ? "inscricoes"
      : finished
        ? "encerrada"
        : "andamento";
  if (status !== edition.status) {
    await db.update(editions).set({ status }).where(eq(editions.id, editionId));
  }
}

export interface ScoreInput {
  homeScore: unknown;
  awayScore: unknown;
  homePens?: unknown;
  awayPens?: unknown;
}

function parseScore(value: unknown, what: string) {
  const text = String(value ?? "").trim();
  const n = Number(text);
  if (text === "" || !Number.isInteger(n) || n < 0 || n > 99)
    throw new UserError(`Informe ${what} com um número de 0 a 99.`);
  return n;
}

export async function saveMatchResult(
  db: Db,
  matchId: number,
  input: ScoreInput,
) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) throw new UserError("Jogo não encontrado.");
  if (match.homeEntryId == null || match.awayEntryId == null)
    throw new UserError("Este confronto ainda não está definido.");

  const homeScore = parseScore(input.homeScore, "o placar");
  const awayScore = parseScore(input.awayScore, "o placar");
  let homePens: number | null = null;
  let awayPens: number | null = null;
  if (match.stage !== "grupo" && homeScore === awayScore) {
    homePens = parseScore(input.homePens, "os pênaltis");
    awayPens = parseScore(input.awayPens, "os pênaltis");
    if (homePens === awayPens)
      throw new UserError("A disputa de pênaltis precisa ter um vencedor.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        homeScore,
        awayScore,
        homePens,
        awayPens,
        playedAt: new Date().toISOString(),
      })
      .where(eq(matches.id, matchId));
    await syncEdition(tx, match.editionId);
  });
}

export async function clearMatchResult(db: Db, matchId: number) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) throw new UserError("Jogo não encontrado.");
  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        homeScore: null,
        awayScore: null,
        homePens: null,
        awayPens: null,
        playedAt: null,
      })
      .where(eq(matches.id, matchId));
    await syncEdition(tx, match.editionId);
  });
}

const UNIQUE_RESULTS: ResultCode[] = ["campeao", "vice", "terceiro", "quarto"];

/** Colocação informada à mão, para edições de registro histórico. */
export async function setEntryResult(db: Db, entryId: number, result: unknown) {
  const entry = await getEntry(db, entryId);
  const edition = await getEdition(db, entry.editionId);
  if (edition.format !== "manual")
    throw new UserError("A colocação desta edição é calculada pelos jogos.");
  const code = String(result ?? "") as ResultCode;
  if (code && !RESULT_ORDER.includes(code))
    throw new UserError("Colocação inválida.");

  await db.transaction(async (tx) => {
    if (UNIQUE_RESULTS.includes(code)) {
      // Só pode haver um campeão, um vice etc.: quem tinha o posto perde.
      const siblings = await tx
        .select()
        .from(entries)
        .where(eq(entries.editionId, entry.editionId));
      for (const other of siblings) {
        if (other.id !== entryId && other.result === code) {
          await tx
            .update(entries)
            .set({ result: null })
            .where(eq(entries.id, other.id));
        }
      }
    }
    await tx
      .update(entries)
      .set({ result: code || null })
      .where(eq(entries.id, entryId));
  });
}

// ---------------------------------------------------------------------------
// Leitura

export type EntryView = Entry & { player: Player; team: Team | null };

export interface EditionView {
  edition: Edition;
  entries: EntryView[];
  matches: Match[];
}

export async function loadAll(db: Db): Promise<AllData> {
  const [p, t, ed, en, m] = await Promise.all([
    db.select(playerColumns).from(players),
    db.select().from(teams),
    db.select().from(editions),
    db.select().from(entries),
    db.select().from(matches),
  ]);
  return { players: p, teams: t, editions: ed, entries: en, matches: m };
}

/** Mais recentes primeiro: pelo número da edição e, em caso de empate, pela data. */
export function sortEditions(list: Edition[]) {
  return [...list].sort(
    (a, b) =>
      b.number - a.number || (b.playedOn ?? "").localeCompare(a.playedOn ?? ""),
  );
}

export function editionView(
  data: AllData,
  editionId: number,
): EditionView | null {
  const edition = data.editions.find((e) => e.id === editionId);
  if (!edition) return null;
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  return {
    edition,
    entries: data.entries
      .filter((e) => e.editionId === editionId && playerById.has(e.playerId))
      .map((e) => ({
        ...e,
        player: playerById.get(e.playerId)!,
        team: e.teamId != null ? (teamById.get(e.teamId) ?? null) : null,
      }))
      .sort((a, b) => a.seed - b.seed || a.id - b.id),
    matches: data.matches
      .filter((m) => m.editionId === editionId)
      .sort((a, b) => a.round - b.round || a.slot - b.slot || a.id - b.id),
  };
}

export function allEditionViews(data: AllData): EditionView[] {
  return sortEditions(data.editions).map((e) => editionView(data, e.id)!);
}

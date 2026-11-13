// Operações de leitura e escrita no banco. Não dependem do Next.js, então
// podem ser exercitadas direto nos testes.
import { randomInt } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  editions,
  entries,
  matches,
  players,
  teams,
  type Edition,
  type Entry,
  type Match,
  type Player,
  type Team,
} from "@/db/schema";
import { RESULT_ORDER } from "./labels";
import type { AllData } from "./stats";
import {
  GROUP_LABELS,
  assignGroups,
  computeResults,
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
  };
}

// ---------------------------------------------------------------------------
// Jogadores

export async function listPlayers(db: Db) {
  const rows = await db.select().from(players);
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

function cleanPhotoUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 500)
    throw new UserError("O link da foto precisa começar com http:// ou https://.");
  return url;
}

export async function createPlayer(db: Db, rawName: unknown, photo?: unknown) {
  const name = clean(rawName, 40);
  if (!name) throw new UserError("Informe o nome do jogador.");
  if (await findPlayerByName(db, name))
    throw new UserError(`Já existe um jogador chamado ${name}.`);
  const [row] = await db
    .insert(players)
    .values({ name, photoUrl: cleanPhotoUrl(photo) })
    .returning();
  return row;
}

export async function updatePlayer(
  db: Db,
  id: number,
  input: { name: unknown; photoUrl: unknown },
) {
  const name = clean(input.name, 40);
  if (!name) throw new UserError("Informe o nome do jogador.");
  const other = await findPlayerByName(db, name);
  if (other && other.id !== id)
    throw new UserError(`Já existe um jogador chamado ${name}.`);
  await db
    .update(players)
    .set({ name, photoUrl: cleanPhotoUrl(input.photoUrl) })
    .where(eq(players.id, id));
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
  return { name, game, number, playedOn, notes: clean(input.notes, 500) || null };
}

function parseConfig(config: FormatConfig) {
  if (!FORMATS.includes(config.format)) throw new UserError("Formato inválido.");
  return normalizeConfig({
    format: config.format,
    groupsCount: Number(config.groupsCount) || 0,
    legs: Number(config.legs) || 1,
    pairing: config.pairing,
    crossGames: Number(config.crossGames) || 0,
    qualifiers: Number(config.qualifiers) || 0,
    thirdPlace: Boolean(config.thirdPlace),
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
      if (found.length !== ids.size) throw new UserError("Jogador não encontrado.");
    }
    const [edition] = await tx
      .insert(editions)
      .values({
        ...meta,
        ...config,
        status: config.format === "manual" ? "encerrada" : "inscricoes",
        teamPool: cleanTeamList(input.teamPool ?? []),
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
  await db
    .update(editions)
    .set({ ...meta, ...config })
    .where(eq(editions.id, id));
}

function assertEditable(edition: Edition) {
  if (edition.format !== "manual" && edition.status !== "inscricoes")
    throw new UserError(
      "A tabela já foi gerada. Desfaça a tabela para mudar os participantes.",
    );
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

async function getEntry(db: Db, entryId: number) {
  const [entry] = await db.select().from(entries).where(eq(entries.id, entryId));
  if (!entry) throw new UserError("Participante não encontrado.");
  return entry;
}

/** Define (ou remove) manualmente o time de um participante. */
export async function setEntryTeam(db: Db, entryId: number, teamName: unknown) {
  const entry = await getEntry(db, entryId);
  const name = clean(teamName, 60);
  if (!name) {
    await db.update(entries).set({ teamId: null }).where(eq(entries.id, entryId));
    return;
  }
  const team = await ensureTeam(db, name);
  const siblings = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, entry.editionId));
  if (siblings.some((e) => e.id !== entryId && e.teamId === team.id))
    throw new UserError(`${team.name} já está com outro participante.`);
  await db.update(entries).set({ teamId: team.id }).where(eq(entries.id, entryId));
}

export interface DrawAssignment {
  entryId: number;
  playerName: string;
  teamName: string;
}

/** Sorteia um time da lista para cada participante. */
export async function drawTeams(db: Db, editionId: number): Promise<DrawAssignment[]> {
  const edition = await getEdition(db, editionId);
  if (edition.status !== "inscricoes")
    throw new UserError("O sorteio só pode ser feito antes de gerar a tabela.");
  const rows = await db
    .select({ entry: entries, player: players })
    .from(entries)
    .innerJoin(players, eq(entries.playerId, players.id))
    .where(eq(entries.editionId, editionId));
  if (rows.length < 2)
    throw new UserError("Adicione pelo menos 2 participantes antes de sortear.");
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
  teamName: string | null;
  groupLabel: string | null;
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
    throw new UserError("Edições de registro histórico não têm tabela de jogos.");
  if (edition.status !== "inscricoes")
    throw new UserError("A tabela desta edição já foi gerada.");
  const config = configOf(edition);
  const current = await db
    .select()
    .from(entries)
    .where(eq(entries.editionId, editionId));
  const problem = validateConfig(config, current.length);
  if (problem) throw new UserError(problem);
  if (current.some((e) => e.teamId == null))
    throw new UserError("Ainda há participantes sem time. Faça o sorteio primeiro.");

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
      playerName: players.name,
      teamName: teams.name,
    })
    .from(entries)
    .innerJoin(players, eq(entries.playerId, players.id))
    .leftJoin(teams, eq(entries.teamId, teams.id))
    .where(eq(entries.editionId, editionId));
  const byEntry = new Map(names.map((n) => [n.entryId, n]));
  return seeded.map((e) => ({
    entryId: e.id,
    playerName: byEntry.get(e.id)?.playerName ?? "",
    teamName: byEntry.get(e.id)?.teamName ?? null,
    groupLabel: e.groupLabel,
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
    matchRows.length === 0 ? "inscricoes" : finished ? "encerrada" : "andamento";
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

export async function saveMatchResult(db: Db, matchId: number, input: ScoreInput) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
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
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
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
    db.select().from(players),
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

export function editionView(data: AllData, editionId: number): EditionView | null {
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

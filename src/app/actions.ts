"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  currentPlayerId,
  endPlayerSession,
  isAdmin,
  login,
  logout,
  requireAdmin,
} from "@/lib/auth";
import { ApiFootballError } from "@/lib/apiFootball";
import * as svc from "@/lib/services";
import type { FormatConfig } from "@/lib/tournament";

export type ActionState = { error?: string; ok?: boolean } | null;

/** Executa uma alteração de administrador e traduz erros esperados em mensagem. */
async function run(fn: () => Promise<unknown>): Promise<ActionState> {
  await requireAdmin();
  try {
    await fn();
  } catch (err) {
    if (err instanceof svc.UserError) return { error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const id = (fd: FormData, key: string) => Number(fd.get(key));

function configFrom(fd: FormData): FormatConfig {
  return {
    format: String(fd.get("format") ?? "manual") as FormatConfig["format"],
    groupsCount: Number(fd.get("groupsCount")) || 0,
    legs: Number(fd.get("legs")) || 1,
    pairing: String(fd.get("pairing") ?? "interno") as FormatConfig["pairing"],
    crossGames: Number(fd.get("crossGames")) || 0,
    qualifiers: Number(fd.get("qualifiers")) || 0,
    thirdPlace: fd.get("thirdPlace") === "on",
    playoffs: Number(fd.get("playoffs")) || 0,
  };
}

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

// --- Sessão ----------------------------------------------------------------

export async function loginAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const result = await login(String(fd.get("password") ?? ""));
  if (!result.ok) {
    if (result.blocked) {
      const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
      return {
        error: `Muitas tentativas. Tente de novo em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
      };
    }
    return { error: "Senha incorreta." };
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

// --- Jogadores -------------------------------------------------------------

export async function createPlayerAction(_prev: ActionState, fd: FormData) {
  return run(() =>
    svc.createPlayer(
      getDb(),
      fd.get("name"),
      fd.get("photoUrl"),
      fd.get("photoData"),
    ),
  );
}

/** Campo "avatar" do formulário: JSON com a aparência, vazio = automático. */
function parseAvatarField(value: FormDataEntryValue | null): unknown {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return "invalido"; // vira erro de "aparência inválida" no serviço
  }
}

// --- Acesso do jogador ao próprio perfil -----------------------------------

export type AccessLinkState = {
  error?: string;
  path?: string;
  ok?: boolean;
} | null;

/** Organizador: gera um link novo de acesso (o anterior deixa de valer). */
export async function createAccessLinkAction(
  _prev: AccessLinkState,
  fd: FormData,
): Promise<AccessLinkState> {
  await requireAdmin();
  try {
    const token = await svc.createPlayerAccess(getDb(), id(fd, "playerId"));
    revalidatePath("/", "layout");
    return { ok: true, path: `/entrar/${token}` };
  } catch (err) {
    if (err instanceof svc.UserError) return { error: err.message };
    throw err;
  }
}

export async function revokeAccessAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.revokePlayerAccess(getDb(), id(fd, "playerId")));
}

/**
 * Tela de edição do perfil. O organizador muda tudo (inclusive o nome); o
 * jogador com sessão muda só a foto e o avatar, e só do próprio perfil.
 */
export async function saveProfileAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const playerId = id(fd, "playerId");
  const admin = await isAdmin();
  if (!admin && (await currentPlayerId()) !== playerId) {
    return {
      error:
        "Você só pode editar o seu próprio perfil. Se a sessão expirou, abra o seu link de acesso de novo.",
    };
  }
  const look = {
    photoUrl: fd.get("photoUrl"),
    avatar: parseAvatarField(fd.get("avatar")),
    photoData: fd.get("photoData"),
    removePhoto: fd.get("removePhoto") === "1",
  };
  try {
    if (admin)
      await svc.updatePlayer(getDb(), playerId, {
        ...look,
        name: fd.get("name"),
      });
    else await svc.updatePlayerProfile(getDb(), playerId, look);
  } catch (err) {
    if (err instanceof svc.UserError) return { error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/jogadores/${playerId}`);
}

export async function playerLogoutAction() {
  await endPlayerSession();
  redirect("/");
}

// --- Times -----------------------------------------------------------------

/** Junta um time digitado errado ao certo (participantes e listas de sorteio). */
export async function mergeTeamsAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.mergeTeams(getDb(), id(fd, "fromId"), id(fd, "intoId")));
}

export async function renameTeamAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.renameTeam(getDb(), id(fd, "teamId"), fd.get("name")));
}

export async function deleteTeamAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.deleteTeam(getDb(), id(fd, "teamId")));
}

/** Apaga os times que nenhum participante usa. */
export async function deleteUnusedTeamsAction(): Promise<ActionState> {
  return run(() => svc.deleteUnusedTeams(getDb()));
}

export async function deletePlayerAction(_prev: ActionState, fd: FormData) {
  const state = await run(() => svc.deletePlayer(getDb(), id(fd, "playerId")));
  if (state?.ok) redirect("/jogadores");
  return state;
}

// --- Edições ---------------------------------------------------------------

export interface NewEditionPayload {
  name: string;
  number: number;
  game: string;
  playedOn: string;
  useTeams: boolean;
  config: FormatConfig;
  playerIds: number[];
  newPlayerNames: string[];
  teamPool: string[];
}

export async function createEditionAction(
  payload: NewEditionPayload,
): Promise<ActionState> {
  let editionId = 0;
  const state = await run(async () => {
    editionId = (await svc.createEdition(getDb(), payload)).id;
  });
  if (state?.ok) redirect(`/edicoes/${editionId}`);
  return state;
}

export async function updateEditionAction(_prev: ActionState, fd: FormData) {
  return run(() =>
    svc.updateEdition(getDb(), id(fd, "editionId"), {
      name: fd.get("name"),
      number: fd.get("number"),
      game: fd.get("game"),
      playedOn: fd.get("playedOn"),
      notes: fd.get("notes"),
      useTeams: fd.get("useTeams") === "on",
      config: configFrom(fd),
    }),
  );
}

export async function setParticipantsAction(_prev: ActionState, fd: FormData) {
  return run(async () => {
    const db = getDb();
    const ids = fd.getAll("playerId").map(Number);
    for (const name of lines(fd.get("newPlayers"))) {
      const existing = (await svc.listPlayers(db)).find(
        (p) =>
          p.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      );
      ids.push((existing ?? (await svc.createPlayer(db, name))).id);
    }
    await svc.setParticipants(db, id(fd, "editionId"), ids);
  });
}

export async function setTeamPoolAction(_prev: ActionState, fd: FormData) {
  return run(() =>
    svc.setTeamPool(getDb(), id(fd, "editionId"), lines(fd.get("teamPool"))),
  );
}

// --- Escolha dos times (citar e banir) -------------------------------------

export async function addTeamPickAction(
  editionId: number,
  playerId: number,
  team: string,
) {
  // Só o admin chega aqui: ele pode citar por qualquer jogador, fora da vez.
  return run(() =>
    svc.addTeamPick(getDb(), editionId, playerId, team, { anyOrder: true }),
  );
}

export async function banTeamAction(
  editionId: number,
  playerId: number,
  team: string,
) {
  return run(() =>
    svc.banTeam(getDb(), editionId, playerId, team, { anyOrder: true }),
  );
}

export async function removeTeamChoiceAction(choiceId: number) {
  return run(() => svc.removeTeamChoice(getDb(), choiceId));
}

export async function resetTeamChoicesAction(editionId: number) {
  return run(() => svc.resetTeamChoices(getDb(), editionId));
}

export async function drawChoiceTeamsAction(editionId: number) {
  return run(() => svc.drawChoiceTeams(getDb(), editionId));
}

/** Sorteia os grupos depois do sorteio dos times (quando não saiu junto). */
export async function drawChoiceGroupsAction(editionId: number) {
  return run(() => svc.startEdition(getDb(), editionId));
}

export async function resetTeamDrawAction(editionId: number) {
  return run(() => svc.resetTeamDraw(getDb(), editionId));
}

/** Time do participante e, nas edições de registro histórico, a colocação. */
export async function saveEntryAction(_prev: ActionState, fd: FormData) {
  return run(async () => {
    const db = getDb();
    await svc.setEntryTeam(db, id(fd, "entryId"), fd.get("team"));
    if (fd.has("result")) {
      await svc.setEntryResult(db, id(fd, "entryId"), fd.get("result"));
    }
  });
}

export async function removeEntryAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.removeEntry(getDb(), id(fd, "entryId")));
}

export async function drawTeamsAction(
  editionId: number,
): Promise<{ error?: string; draw?: svc.DrawAssignment[] }> {
  let draw: svc.DrawAssignment[] = [];
  const state = await run(async () => {
    draw = await svc.drawTeams(getDb(), editionId);
  });
  return state?.error ? { error: state.error } : { draw };
}

/**
 * Gera a tabela e devolve o sorteio. Não atualiza a página por conta própria:
 * quem chama faz isso depois de mostrar a animação do sorteio dos grupos.
 */
export async function startEditionAction(
  editionId: number,
): Promise<{ error?: string; draw?: svc.GroupDrawItem[] }> {
  await requireAdmin();
  try {
    return { draw: await svc.startEdition(getDb(), editionId) };
  } catch (err) {
    if (err instanceof svc.UserError) return { error: err.message };
    throw err;
  }
}

/** Grupos de cada participante, vindos dos campos group_<id> do formulário. */
export async function setGroupsAction(_prev: ActionState, fd: FormData) {
  return run(() => {
    const assignments: svc.GroupAssignment[] = [];
    for (const [key, value] of fd.entries()) {
      const m = /^group_(\d+)$/.exec(key);
      if (m) {
        assignments.push({
          entryId: Number(m[1]),
          groupLabel: String(value) || null,
        });
      }
    }
    return svc.setEntryGroups(getDb(), id(fd, "editionId"), assignments);
  });
}

/** Confrontos do mata-mata, vindos dos campos slot_<jogo>_<home|away>. */
export async function setKnockoutAction(_prev: ActionState, fd: FormData) {
  return run(() => {
    const slots: svc.KnockoutSlotInput[] = [];
    for (const [key, value] of fd.entries()) {
      const m = /^slot_(\d+)_(home|away)$/.exec(key);
      if (m) {
        slots.push({
          matchId: Number(m[1]),
          side: m[2] as "home" | "away",
          entryId: String(value) ? Number(value) : null,
        });
      }
    }
    return svc.setKnockoutSlots(getDb(), id(fd, "editionId"), slots);
  });
}

export async function setKnockoutPhasesAction(
  _prev: ActionState,
  fd: FormData,
) {
  return run(() =>
    svc.setKnockoutPhases(getDb(), id(fd, "editionId"), {
      qualifiers: Number(fd.get("qualifiers")),
      thirdPlace: fd.get("thirdPlace") === "on",
      playoffs: Number(fd.get("playoffs")) || 0,
    }),
  );
}

export async function regenerateMatchesAction(
  _prev: ActionState,
  fd: FormData,
) {
  return run(() => svc.regenerateMatches(getDb(), id(fd, "editionId")));
}

export async function resetEditionAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.resetEdition(getDb(), id(fd, "editionId")));
}

export async function deleteEditionAction(_prev: ActionState, fd: FormData) {
  const state = await run(() =>
    svc.deleteEdition(getDb(), id(fd, "editionId")),
  );
  if (state?.ok) redirect("/edicoes");
  return state;
}

// --- Placares --------------------------------------------------------------

export async function saveResultAction(
  matchId: number,
  score: svc.ScoreInput,
): Promise<ActionState> {
  return run(() => svc.saveMatchResult(getDb(), matchId, score));
}

export async function clearResultAction(matchId: number): Promise<ActionState> {
  return run(() => svc.clearMatchResult(getDb(), matchId));
}

// --- Escudos dos times -------------------------------------------------------

export async function setTeamBadgeAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.setTeamBadge(getDb(), id(fd, "teamId"), fd.get("badgeUrl")));
}

/** Erro da API-Football para a tela, dizendo se vale esperar e tentar de novo. */
function badgeError(err: unknown) {
  if (err instanceof ApiFootballError)
    return { error: err.message, waitMinute: err.problem === "minuto" };
  if (err instanceof svc.UserError) return { error: err.message, waitMinute: false };
  throw err;
}

export async function searchTeamBadgesAction(teamId: number, term: string) {
  await requireAdmin();
  try {
    return { candidates: await svc.searchTeamBadges(getDb(), teamId, term) };
  } catch (err) {
    return badgeError(err);
  }
}

export async function chooseTeamBadgeAction(teamId: number, url: string) {
  await requireAdmin();
  try {
    await svc.setTeamBadge(getDb(), teamId, url);
  } catch (err) {
    return badgeError(err);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function fillLeagueBadgesAction(league: string, maxSeason?: number) {
  await requireAdmin();
  try {
    const result = await svc.fillLeagueBadges(getDb(), league, maxSeason);
    if (result.matched.length) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return badgeError(err);
  }
}

// --- Participante incluído com a edição em andamento -------------------------

/** Resultado da inclusão; com time sorteado, traz o que a tela anima. */
export type LateEntryState =
  | (NonNullable<ActionState> & { result?: svc.LateEntryResult; at?: number })
  | null;

export async function addLateEntryAction(
  _prev: LateEntryState,
  fd: FormData,
): Promise<LateEntryState> {
  await requireAdmin();
  const raw = String(fd.get("playerId") ?? "");
  try {
    const result = await svc.addLateEntry(getDb(), id(fd, "editionId"), {
      playerId: /^\d+$/.test(raw) ? Number(raw) : null,
      newName: fd.get("newName"),
      groupLabel: fd.get("groupLabel"),
      team: fd.get("team"),
      drawTeam: fd.get("teamMode") === "sortear",
    });
    revalidatePath("/", "layout");
    // `at` muda a cada inclusão, para a tela animar de novo.
    return { ok: true, result, at: Date.now() };
  } catch (err) {
    if (err instanceof svc.UserError) return { error: err.message };
    throw err;
  }
}

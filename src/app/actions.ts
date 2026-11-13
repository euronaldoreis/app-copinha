"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { login, logout, requireAdmin } from "@/lib/auth";
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
  const ok = await login(String(fd.get("password") ?? ""));
  if (!ok) return { error: "Senha incorreta." };
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

// --- Jogadores -------------------------------------------------------------

export async function createPlayerAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.createPlayer(getDb(), fd.get("name"), fd.get("photoUrl")));
}

export async function updatePlayerAction(_prev: ActionState, fd: FormData) {
  return run(() =>
    svc.updatePlayer(getDb(), id(fd, "playerId"), {
      name: fd.get("name"),
      photoUrl: fd.get("photoUrl"),
    }),
  );
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
        (p) => p.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
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

export async function resetEditionAction(_prev: ActionState, fd: FormData) {
  return run(() => svc.resetEdition(getDb(), id(fd, "editionId")));
}

export async function deleteEditionAction(_prev: ActionState, fd: FormData) {
  const state = await run(() => svc.deleteEdition(getDb(), id(fd, "editionId")));
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

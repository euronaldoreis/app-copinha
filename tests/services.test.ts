import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db";
import { entries, matches } from "@/db/schema";
import {
  UserError,
  createEdition,
  createPlayer,
  deletePlayer,
  drawTeams,
  editionView,
  loadAll,
  resetEdition,
  saveMatchResult,
  setEntryResult,
  setEntryTeam,
  startEdition,
} from "@/lib/services";
import { computeHeadToHead, computeRanking, computeRecords } from "@/lib/stats";

const dir = mkdtempSync(join(tmpdir(), "copinha-test-"));
const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);

const NAMES = ["Ronaldo", "Bruno", "Caio", "Diego", "Edu", "Fábio", "Gui", "Hugo"];
const TEAMS = [
  "Íbis",
  "Tabajara",
  "San Marino",
  "XV de Piracicaba",
  "Gibraltar",
  "Andorra",
  "Bangu",
  "Liechtenstein",
  "Olaria",
];

const playerIds: number[] = [];

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  for (const name of NAMES) playerIds.push((await createPlayer(db, name)).id);
});

afterAll(() => {
  db.$client.close();
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // No Windows o arquivo do banco pode continuar travado por um instante;
    // a pasta temporária fica para o sistema limpar.
  }
});

const baseEdition = {
  game: "FIFA 23",
  playedOn: "2026-03-14",
  config: {
    format: "grupos" as const,
    groupsCount: 2,
    legs: 1,
    pairing: "interno" as const,
    crossGames: 0,
    qualifiers: 4,
    thirdPlace: true,
  },
};

async function view(editionId: number) {
  return editionView(await loadAll(db), editionId)!;
}

/** Lança placares até não sobrar jogo definido: vence quem tem o menor id de jogador. */
async function playEverything(editionId: number) {
  for (let guard = 0; guard < 200; guard++) {
    const v = await view(editionId);
    const playerOf = new Map(v.entries.map((e) => [e.id, e.playerId]));
    const next = v.matches.find(
      (m) => m.homeScore == null && m.homeEntryId != null && m.awayEntryId != null,
    );
    if (!next) return;
    const homeWins =
      playerOf.get(next.homeEntryId!)! < playerOf.get(next.awayEntryId!)!;
    await saveMatchResult(db, next.id, {
      homeScore: homeWins ? 3 : 1,
      awayScore: homeWins ? 1 : 3,
    });
  }
  throw new Error("a edição não terminou");
}

describe("jogadores", () => {
  it("não aceita nome repetido, mesmo mudando maiúsculas e acentos", async () => {
    await expect(createPlayer(db, "ronaldo")).rejects.toBeInstanceOf(UserError);
    await expect(createPlayer(db, "FÁBIO")).rejects.toBeInstanceOf(UserError);
  });
});

describe("edição com grupos e mata-mata", () => {
  let editionId = 0;

  it("cria a edição e sorteia um time diferente para cada um", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha dos Lixos #1",
      number: 1,
      playerIds,
      teamPool: TEAMS,
    });
    editionId = edition.id;
    expect(edition.status).toBe("inscricoes");

    const draw = await drawTeams(db, editionId);
    expect(draw).toHaveLength(8);
    expect(new Set(draw.map((d) => d.teamName)).size).toBe(8);
    const v = await view(editionId);
    expect(v.entries.every((e) => e.team != null)).toBe(true);
  });

  it("não deixa dois participantes com o mesmo time", async () => {
    const v = await view(editionId);
    await expect(
      setEntryTeam(db, v.entries[0].id, v.entries[1].team!.name),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("gera 12 jogos de grupo e 4 de mata-mata", async () => {
    await startEdition(db, editionId);
    const v = await view(editionId);
    expect(v.edition.status).toBe("andamento");
    expect(v.matches.filter((m) => m.stage === "grupo")).toHaveLength(12);
    expect(v.matches.filter((m) => m.stage !== "grupo")).toHaveLength(4);
    expect(v.entries.filter((e) => e.groupLabel === "A")).toHaveLength(4);
    await expect(startEdition(db, editionId)).rejects.toBeInstanceOf(UserError);
  });

  it("exige pênaltis em empate de mata-mata e recusa placar inválido", async () => {
    const v = await view(editionId);
    const group = v.matches.find((m) => m.stage === "grupo")!;
    await expect(
      saveMatchResult(db, group.id, { homeScore: "x", awayScore: 1 }),
    ).rejects.toBeInstanceOf(UserError);
    const semi = v.matches.find((m) => m.stage === "mata")!;
    await expect(
      saveMatchResult(db, semi.id, { homeScore: 1, awayScore: 0 }),
    ).rejects.toThrow("ainda não está definido");
  });

  it("joga a edição inteira e encerra com as colocações", async () => {
    await playEverything(editionId);
    const v = await view(editionId);
    expect(v.edition.status).toBe("encerrada");
    expect(v.matches.every((m) => m.homeScore != null)).toBe(true);

    // Vence sempre o menor id: Ronaldo é o campeão e Bruno, o vice.
    const champion = v.entries.find((e) => e.result === "campeao")!;
    expect(champion.player.name).toBe("Ronaldo");
    const vice = v.entries.find((e) => e.result === "vice")!;
    expect(vice.player.name).toBe("Bruno");
    const count = (code: string) =>
      v.entries.filter((e) => e.result === code).length;
    expect(count("terceiro")).toBe(1);
    expect(count("quarto")).toBe(1);
    expect(count("grupos")).toBe(4);
  });

  it("corrigir a final para empate exige pênaltis e troca o campeão", async () => {
    const v = await view(editionId);
    const final = v.matches.find((m) => m.stage === "mata" && m.round === 2)!;
    await expect(
      saveMatchResult(db, final.id, { homeScore: 2, awayScore: 2 }),
    ).rejects.toBeInstanceOf(UserError);

    const ronaldo = v.entries.find((e) => e.player.name === "Ronaldo")!;
    const ronaldoIsHome = final.homeEntryId === ronaldo.id;
    await saveMatchResult(db, final.id, {
      homeScore: 2,
      awayScore: 2,
      homePens: ronaldoIsHome ? 4 : 5,
      awayPens: ronaldoIsHome ? 5 : 4,
    });
    const after = await view(editionId);
    expect(after.edition.status).toBe("encerrada");
    const champion = after.entries.find((e) => e.result === "campeao")!;
    expect(champion.player.name).toBe("Bruno");
    expect(after.entries.find((e) => e.result === "vice")!.player.name).toBe(
      "Ronaldo",
    );
  });
});

describe("histórico e ranking", () => {
  it("registra edição antiga à mão e soma tudo no ranking", async () => {
    const old = await createEdition(db, {
      ...baseEdition,
      name: "Copinha raiz",
      number: 2,
      playedOn: "2024-12-20",
      game: "Bomba Patch",
      config: { ...baseEdition.config, format: "manual" },
      playerIds: playerIds.slice(0, 4),
      newPlayerNames: ["Ivo"],
    });
    expect(old.status).toBe("encerrada");
    const v = await view(old.id);
    expect(v.entries).toHaveLength(5);

    const ronaldo = v.entries.find((e) => e.player.name === "Ronaldo")!;
    const bruno = v.entries.find((e) => e.player.name === "Bruno")!;
    await setEntryResult(db, bruno.id, "campeao");
    await setEntryResult(db, ronaldo.id, "campeao"); // toma o posto do Bruno
    await setEntryResult(db, bruno.id, "vice");

    const data = await loadAll(db);
    const ranking = computeRanking(data);
    const row = (name: string) => ranking.find((r) => r.player.name === name)!;

    // Ronaldo: vice na #1 (perdeu a final nos pênaltis) + campeão na antiga.
    expect(row("Ronaldo")).toMatchObject({
      titles: 1,
      vices: 1,
      finals: 2,
      participations: 2,
    });
    expect(row("Bruno")).toMatchObject({ titles: 1, vices: 1, finals: 2 });
    expect(row("Ivo")).toMatchObject({ participations: 1, titles: 0, played: 0 });
    // 3 jogos de grupo + semifinal + final
    expect(row("Ronaldo").played).toBe(5);
    expect(row("Ronaldo").draws).toBe(1);
    expect(row("Ronaldo").wins).toBe(4);
    expect(ranking[0].titles).toBe(1);

    const h2h = computeHeadToHead(data, row("Ronaldo").player.id);
    expect(h2h.reduce((sum, r) => sum + r.played, 0)).toBe(5);

    const records = computeRecords(data);
    expect(records.biggestWin).not.toBeNull();
    expect(records.mostGoals!.homeScore + records.mostGoals!.awayScore).toBe(4);
  });

  it("edição com confrontos mistos gera os jogos entre grupos e termina", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha mista",
      number: 4,
      config: { ...baseEdition.config, pairing: "misto", crossGames: 2 },
      playerIds,
      teamPool: TEAMS,
    });
    expect(edition.pairing).toBe("misto");
    expect(edition.crossGames).toBe(2);
    await drawTeams(db, edition.id);
    await startEdition(db, edition.id);
    let v = await view(edition.id);
    const groupGames = v.matches.filter((m) => m.stage === "grupo");
    // 12 jogos dentro dos grupos + 2 contra o outro grupo para cada um dos 8
    expect(groupGames).toHaveLength(12 + 8);
    const groupOf = new Map(v.entries.map((e) => [e.id, e.groupLabel]));
    const cross = groupGames.filter(
      (m) => groupOf.get(m.homeEntryId!) !== groupOf.get(m.awayEntryId!),
    );
    expect(cross).toHaveLength(8);

    await playEverything(edition.id);
    v = await view(edition.id);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.find((e) => e.result === "campeao")!.player.name).toBe(
      "Ronaldo",
    );
  });

  it("não exclui jogador com histórico", async () => {
    await expect(deletePlayer(db, playerIds[0])).rejects.toBeInstanceOf(UserError);
  });

  it("desfazer a tabela volta para inscrições e limpa as colocações", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha mata-mata",
      number: 3,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 6),
      teamPool: TEAMS,
    });
    await drawTeams(db, edition.id);
    await startEdition(db, edition.id);
    let v = await view(edition.id);
    // 6 participantes: 2 jogos na 1ª fase, 2 semis, final e 3º lugar
    expect(v.matches).toHaveLength(6);
    await playEverything(edition.id);
    v = await view(edition.id);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.filter((e) => e.result === "campeao")).toHaveLength(1);

    await resetEdition(db, edition.id);
    v = await view(edition.id);
    expect(v.edition.status).toBe("inscricoes");
    expect(v.matches).toHaveLength(0);
    expect(v.entries.every((e) => e.result == null)).toBe(true);
    const leftovers = await db
      .select()
      .from(matches)
      .where(eq(matches.editionId, edition.id));
    expect(leftovers).toHaveLength(0);
    expect(
      await db.select().from(entries).where(eq(entries.editionId, edition.id)),
    ).toHaveLength(6);
  });
});

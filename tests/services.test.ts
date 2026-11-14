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
  regenerateMatches,
  removeEntry,
  setKnockoutPhases,
  setEntryGroups,
  setKnockoutSlots,
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

// Fica por último: termina uma edição inteira e alteraria as contagens do ranking.
describe("grupos manuais e rodadas novas", () => {
  let editionId = 0;
  const label = (n: number) => (n < 5 ? "A" : "B");

  it("monta os grupos à mão antes de gerar a tabela", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha manual",
      number: 20,
      playerIds,
      teamPool: TEAMS,
    });
    editionId = edition.id;
    await drawTeams(db, editionId);
    const v = await view(editionId);

    // só um participante com grupo: não gera, pede todos ou nenhum
    await setEntryGroups(db, editionId, [
      { entryId: v.entries[0].id, groupLabel: "A" },
    ]);
    await expect(startEdition(db, editionId)).rejects.toThrow("todos os participantes");

    // grupo inexistente e participante de outra edição são recusados
    await expect(
      setEntryGroups(db, editionId, [{ entryId: v.entries[1].id, groupLabel: "Z" }]),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      setEntryGroups(db, editionId, [{ entryId: 999999, groupLabel: "A" }]),
    ).rejects.toBeInstanceOf(UserError);

    // 5 no grupo A e 3 no B
    await setEntryGroups(
      db,
      editionId,
      v.entries.map((e, i) => ({ entryId: e.id, groupLabel: label(i) })),
    );
    await startEdition(db, editionId);
    const after = await view(editionId);
    expect(after.edition.status).toBe("andamento");
    const groupOf = new Map(after.entries.map((e) => [e.id, e.groupLabel]));
    for (const [i, e] of v.entries.entries()) expect(groupOf.get(e.id)).toBe(label(i));
    // 10 jogos no grupo de 5, 3 no de 3, mais 4 do mata-mata
    expect(after.matches.filter((m) => m.stage === "grupo")).toHaveLength(13);
    expect(after.matches).toHaveLength(17);
  });

  it("muda um jogador de grupo depois de gerar e refaz as rodadas", async () => {
    const v = await view(editionId);
    const played = v.matches.find((m) => m.stage === "grupo")!;
    await saveMatchResult(db, played.id, { homeScore: 2, awayScore: 1 });

    // mover um do A para o B deixa 4 e 4
    const moved = v.entries.find((e) => e.groupLabel === "A")!;
    await setEntryGroups(db, editionId, [{ entryId: moved.id, groupLabel: "B" }]);
    const after = await view(editionId);
    expect(after.entries.find((e) => e.id === moved.id)!.groupLabel).toBe("B");
    expect(after.matches.filter((m) => m.stage === "grupo")).toHaveLength(12);
    expect(after.matches.every((m) => m.homeScore == null)).toBe(true);
    expect(after.edition.status).toBe("andamento");

    // deixar um grupo vazio ou sem dono é recusado e nada muda
    await expect(
      setEntryGroups(
        db,
        editionId,
        after.entries.map((e) => ({ entryId: e.id, groupLabel: "A" })),
      ),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      setEntryGroups(db, editionId, [{ entryId: moved.id, groupLabel: null }]),
    ).rejects.toThrow("em um grupo");
    expect((await view(editionId)).matches).toHaveLength(16);
  });

  it("gera as rodadas de novo mantendo os grupos e apagando placares", async () => {
    const before = await view(editionId);
    const first = before.matches.find((m) => m.stage === "grupo")!;
    await saveMatchResult(db, first.id, { homeScore: 3, awayScore: 0 });

    await regenerateMatches(db, editionId);
    const after = await view(editionId);
    expect(after.matches).toHaveLength(before.matches.length);
    expect(after.matches.every((m) => m.homeScore == null)).toBe(true);
    const groups = (v: typeof before) =>
      v.entries.map((e) => `${e.id}:${e.groupLabel}`).sort();
    expect(groups(after)).toEqual(groups(before));
    // cada jogo de grupo continua sendo entre dois do mesmo grupo
    const groupOf = new Map(after.entries.map((e) => [e.id, e.groupLabel]));
    for (const m of after.matches.filter((x) => x.stage === "grupo"))
      expect(groupOf.get(m.homeEntryId!)).toBe(groupOf.get(m.awayEntryId!));

    // continua dando para terminar a edição normalmente
    await playEverything(editionId);
    expect((await view(editionId)).edition.status).toBe("encerrada");
  });

  it("não gera rodadas antes de a tabela existir", async () => {
    const draft = await createEdition(db, {
      ...baseEdition,
      name: "Rascunho",
      number: 21,
      playerIds: playerIds.slice(0, 4),
    });
    await expect(regenerateMatches(db, draft.id)).rejects.toBeInstanceOf(UserError);
  });
});

describe("confrontos do mata-mata editados à mão", () => {
  let editionId = 0;

  it("troca os adversários das semifinais e refaz o que depende deles", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Mata-mata manual",
      number: 30,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS,
    });
    editionId = edition.id;
    await drawTeams(db, editionId);
    await startEdition(db, editionId);

    const v = await view(editionId);
    const [semi1, semi2] = v.matches
      .filter((m) => m.stage === "mata" && m.round === 1)
      .sort((a, b) => a.slot - b.slot);
    const ids = v.entries.map((e) => e.id);
    const pair = async (m: typeof semi1) => {
      const now = (await view(editionId)).matches.find((x) => x.id === m.id)!;
      return [now.homeEntryId, now.awayEntryId];
    };

    // novos confrontos: [a, c] e [b, d]
    const [a, b, c, d] = ids;
    await setKnockoutSlots(db, editionId, [
      { matchId: semi1.id, side: "home", entryId: a },
      { matchId: semi1.id, side: "away", entryId: c },
      { matchId: semi2.id, side: "home", entryId: b },
      { matchId: semi2.id, side: "away", entryId: d },
    ]);
    expect(await pair(semi1)).toEqual([a, c]);
    expect(await pair(semi2)).toEqual([b, d]);

    // lançar a 1ª semi, depois trocar quem a joga: o placar some
    await saveMatchResult(db, semi1.id, { homeScore: 1, awayScore: 0 });
    expect(
      (await view(editionId)).matches.find((m) => m.id === semi1.id)!.homeScore,
    ).toBe(1);
    await setKnockoutSlots(db, editionId, [
      { matchId: semi1.id, side: "away", entryId: d },
      { matchId: semi2.id, side: "away", entryId: c },
    ]);
    const after = await view(editionId);
    expect(await pair(semi1)).toEqual([a, d]);
    expect(await pair(semi2)).toEqual([b, c]);
    expect(after.matches.find((m) => m.id === semi1.id)!.homeScore).toBeNull();
    // a final ainda não tem os dois lados
    expect(
      after.matches.find((m) => m.stage === "mata" && m.round === 2)!.homeEntryId,
    ).toBeNull();
  });

  it("recusa repetir participante, mexer em vaga de vencedor e ids de fora", async () => {
    const v = await view(editionId);
    const [semi1, semi2] = v.matches
      .filter((m) => m.stage === "mata" && m.round === 1)
      .sort((a, b) => a.slot - b.slot);
    const final = v.matches.find((m) => m.stage === "mata" && m.round === 2)!;
    const before = JSON.stringify(v.matches);

    await expect(
      setKnockoutSlots(db, editionId, [
        { matchId: semi1.id, side: "home", entryId: v.entries[0].id },
        { matchId: semi2.id, side: "home", entryId: v.entries[0].id },
      ]),
    ).rejects.toThrow("dois confrontos");
    await expect(
      setKnockoutSlots(db, editionId, [
        { matchId: semi1.id, side: "away", entryId: semi1.homeEntryId },
      ]),
    ).rejects.toThrow("ele mesmo");
    await expect(
      setKnockoutSlots(db, editionId, [
        { matchId: final.id, side: "home", entryId: v.entries[0].id },
      ]),
    ).rejects.toThrow("outro jogo");
    await expect(
      setKnockoutSlots(db, editionId, [
        { matchId: semi1.id, side: "home", entryId: 999999 },
      ]),
    ).rejects.toBeInstanceOf(UserError);
    // nada mudou nas tentativas recusadas
    expect(JSON.stringify((await view(editionId)).matches)).toBe(before);
  });

  it("a edição continua até o campeão depois da troca", async () => {
    await playEverything(editionId);
    const v = await view(editionId);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.filter((e) => e.result === "campeao")).toHaveLength(1);
  });

  it("não edita antes de a tabela existir", async () => {
    const draft = await createEdition(db, {
      ...baseEdition,
      name: "Rascunho mata-mata",
      number: 31,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 4),
    });
    await expect(setKnockoutSlots(db, draft.id, [])).rejects.toBeInstanceOf(UserError);
  });
});

describe("remover participante", () => {
  it("tira da edição em inscrições e recusa depois de gerar a tabela", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha com desistência",
      number: 40,
      playerIds: playerIds.slice(0, 5),
      teamPool: TEAMS,
    });
    const v = await view(edition.id);
    expect(v.entries).toHaveLength(5);
    await removeEntry(db, v.entries[0].id);
    const after = await view(edition.id);
    expect(after.entries).toHaveLength(4);
    expect(after.entries.some((e) => e.id === v.entries[0].id)).toBe(false);
    // o jogador continua cadastrado e pode voltar para a edição
    expect((await loadAll(db)).players.some((p) => p.id === v.entries[0].playerId)).toBe(true);

    await expect(removeEntry(db, 999999)).rejects.toBeInstanceOf(UserError);
    await drawTeams(db, edition.id);
    await startEdition(db, edition.id);
    await expect(removeEntry(db, after.entries[0].id)).rejects.toThrow("tabela já foi gerada");
    expect((await view(edition.id)).entries).toHaveLength(4);
  });

  it("em edição de registro histórico pode remover a qualquer momento", async () => {
    const old = await createEdition(db, {
      ...baseEdition,
      name: "Copinha antiga",
      number: 41,
      config: { ...baseEdition.config, format: "manual" },
      playerIds: playerIds.slice(0, 3),
    });
    const v = await view(old.id);
    await removeEntry(db, v.entries[2].id);
    expect((await view(old.id)).entries).toHaveLength(2);
  });
});

describe("mais fases no mata-mata com a copa em andamento", () => {
  let editionId = 0;

  const playGroups = async () => {
    for (const m of (await view(editionId)).matches.filter((x) => x.stage === "grupo")) {
      if (m.homeScore == null)
        await saveMatchResult(db, m.id, { homeScore: 2, awayScore: 1 });
    }
  };

  it("passa de semifinais para quartas mantendo os jogos dos grupos", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copa que cresceu",
      number: 50,
      playerIds,
      teamPool: TEAMS,
    });
    editionId = edition.id;
    await drawTeams(db, editionId);
    await startEdition(db, editionId);
    await playGroups();

    let v = await view(editionId);
    const semi = v.matches.find((m) => m.stage === "mata" && m.round === 1)!;
    expect(v.matches.filter((m) => m.stage === "mata" && m.round === 1)).toHaveLength(2);
    expect(semi.homeEntryId).not.toBeNull(); // grupos acabaram: semis definidas
    await saveMatchResult(db, semi.id, { homeScore: 1, awayScore: 0 });

    await setKnockoutPhases(db, editionId, { qualifiers: 8, thirdPlace: true });
    v = await view(editionId);
    expect(v.edition.qualifiers).toBe(8);
    expect(v.edition.status).toBe("andamento");
    // grupos intactos, com placar
    const groupGames = v.matches.filter((m) => m.stage === "grupo");
    expect(groupGames).toHaveLength(12);
    expect(groupGames.every((m) => m.homeScore != null)).toBe(true);
    // mata-mata novo: 4 quartas, 2 semis, final e 3º lugar, tudo sem placar
    const ko = v.matches.filter((m) => m.stage !== "grupo");
    expect(ko.filter((m) => m.stage === "mata" && m.round === 1)).toHaveLength(4);
    expect(ko.filter((m) => m.stage === "mata" && m.round === 2)).toHaveLength(2);
    expect(ko).toHaveLength(8);
    expect(ko.every((m) => m.homeScore == null)).toBe(true);
    // as quartas já saem preenchidas com a classificação dos grupos
    expect(
      ko.filter((m) => m.round === 1).every((m) => m.homeEntryId && m.awayEntryId),
    ).toBe(true);

    await playEverything(editionId);
    v = await view(editionId);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.filter((e) => e.result === "quartas")).toHaveLength(4);
    expect(v.entries.filter((e) => e.result === "campeao")).toHaveLength(1);
  });

  it("também dá para diminuir as fases e tirar o 3º lugar", async () => {
    await setKnockoutPhases(db, editionId, { qualifiers: 2, thirdPlace: false });
    const v = await view(editionId);
    const ko = v.matches.filter((m) => m.stage !== "grupo");
    expect(ko).toHaveLength(1);
    expect(v.edition.status).toBe("andamento");
    expect(v.entries.every((e) => e.result == null)).toBe(true);
  });

  it("recusa quantidades que não cabem e formatos sem grupos", async () => {
    const before = JSON.stringify((await view(editionId)).matches);
    // 16 classificados com 8 participantes
    await expect(
      setKnockoutPhases(db, editionId, { qualifiers: 16, thirdPlace: false }),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      setKnockoutPhases(db, editionId, { qualifiers: 3, thirdPlace: false }),
    ).rejects.toBeInstanceOf(UserError);
    expect(JSON.stringify((await view(editionId)).matches)).toBe(before);

    const draft = await createEdition(db, {
      ...baseEdition,
      name: "Ainda em inscrições",
      number: 51,
      playerIds: playerIds.slice(0, 4),
    });
    await expect(
      setKnockoutPhases(db, draft.id, { qualifiers: 2, thirdPlace: false }),
    ).rejects.toThrow("Dados e formato");
    const plain = await createEdition(db, {
      ...baseEdition,
      name: "Mata-mata puro",
      number: 52,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS,
    });
    await drawTeams(db, plain.id);
    await startEdition(db, plain.id);
    await expect(
      setKnockoutPhases(db, plain.id, { qualifiers: 8, thirdPlace: false }),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("pontos corridos: passa de campeão por pontos para final e semifinais", async () => {
    const liga = await createEdition(db, {
      ...baseEdition,
      name: "Liga que ganhou final",
      number: 53,
      config: { ...baseEdition.config, format: "liga", groupsCount: 1, qualifiers: 0 },
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS,
    });
    await drawTeams(db, liga.id);
    await startEdition(db, liga.id);
    for (const m of (await view(liga.id)).matches) {
      await saveMatchResult(db, m.id, { homeScore: 1, awayScore: 0 });
    }
    expect((await view(liga.id)).edition.status).toBe("encerrada");

    await setKnockoutPhases(db, liga.id, { qualifiers: 4, thirdPlace: false });
    const v = await view(liga.id);
    expect(v.edition.status).toBe("andamento"); // agora falta o mata-mata
    expect(v.matches.filter((m) => m.stage === "mata")).toHaveLength(3);
    expect(v.matches.filter((m) => m.stage === "grupo").every((m) => m.homeScore != null)).toBe(true);
  });
});

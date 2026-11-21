import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db";
import { entries, matches, players } from "@/db/schema";
import {
  UserError,
  mergeTeams,
  deleteUnusedTeams,
  renameTeam,
  deleteTeam,
  createPlayerAccess,
  findPlayerByAccessToken,
  getPlayerAccessHash,
  playerHasAccess,
  revokePlayerAccess,
  updatePlayerProfile,
  regenerateMatches,
  removeEntry,
  getPlayerPhoto,
  setKnockoutPhases,
  updateEdition,
  updatePlayer,
  setEntryGroups,
  setKnockoutSlots,
  createEdition,
  createPlayer,
  deletePlayer,
  drawReplay,
  drawTeams,
  editionView,
  loadAll,
  resetEdition,
  saveMatchResult,
  setEntryResult,
  setEntryTeam,
  startEdition,
  addTeamPick,
  banTeam,
  listTeamChoices,
  removeTeamChoice,
  resetTeamChoices,
} from "@/lib/services";
import { choiceState } from "@/lib/teamChoice";
import { computeHeadToHead, computeRanking, computeRecords } from "@/lib/stats";

const dir = mkdtempSync(join(tmpdir(), "copinha-test-"));
const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);

const NAMES = [
  "Ronaldo",
  "Bruno",
  "Caio",
  "Diego",
  "Edu",
  "Fábio",
  "Gui",
  "Hugo",
];
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
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
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
      (m) =>
        m.homeScore == null && m.homeEntryId != null && m.awayEntryId != null,
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
    expect(row("Ivo")).toMatchObject({
      participations: 1,
      titles: 0,
      played: 0,
    });
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
    const draw = await startEdition(db, edition.id);
    // Campeão da edição anterior com campeão (a #2, registrada à mão): Ronaldo.
    expect(draw.filter((d) => d.champion).map((d) => d.playerName)).toEqual([
      "Ronaldo",
    ]);
    // Rever o sorteio depois: mesma ordem, grupos e campeão.
    expect(drawReplay(await loadAll(db), edition.id)).toEqual(draw);
    expect(drawReplay(await loadAll(db), 999)).toBeNull();
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
    await expect(deletePlayer(db, playerIds[0])).rejects.toBeInstanceOf(
      UserError,
    );
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
    await expect(startEdition(db, editionId)).rejects.toThrow(
      "todos os participantes",
    );

    // grupo inexistente e participante de outra edição são recusados
    await expect(
      setEntryGroups(db, editionId, [
        { entryId: v.entries[1].id, groupLabel: "Z" },
      ]),
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
    for (const [i, e] of v.entries.entries())
      expect(groupOf.get(e.id)).toBe(label(i));
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
    await setEntryGroups(db, editionId, [
      { entryId: moved.id, groupLabel: "B" },
    ]);
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
    await expect(regenerateMatches(db, draft.id)).rejects.toBeInstanceOf(
      UserError,
    );
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
      after.matches.find((m) => m.stage === "mata" && m.round === 2)!
        .homeEntryId,
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

  it("permite escolher quem joga a semifinal que vem das quartas, mas não a final", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Semis manuais",
      number: 31,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 8),
      teamPool: TEAMS,
    });
    await drawTeams(db, edition.id);
    await startEdition(db, edition.id);
    const v = await view(edition.id);
    const mata = v.matches.filter((m) => m.stage === "mata");
    const semi = mata.find((m) => m.round === 2 && m.slot === 0)!;
    const final = mata.find((m) => m.round === 3)!;
    const who = v.entries[0].id;

    await setKnockoutSlots(db, edition.id, [
      { matchId: semi.id, side: "home", entryId: who },
    ]);
    const after = (await view(edition.id)).matches.find(
      (m) => m.id === semi.id,
    )!;
    expect(after.homeEntryId).toBe(who);
    expect(after.homeSource).toBeNull();

    await expect(
      setKnockoutSlots(db, edition.id, [
        { matchId: final.id, side: "home", entryId: who },
      ]),
    ).rejects.toThrow("outro jogo");
  });

  it("não edita antes de a tabela existir", async () => {
    const draft = await createEdition(db, {
      ...baseEdition,
      name: "Rascunho mata-mata",
      number: 31,
      config: { ...baseEdition.config, format: "mata" },
      playerIds: playerIds.slice(0, 4),
    });
    await expect(setKnockoutSlots(db, draft.id, [])).rejects.toBeInstanceOf(
      UserError,
    );
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
    expect(
      (await loadAll(db)).players.some((p) => p.id === v.entries[0].playerId),
    ).toBe(true);

    await expect(removeEntry(db, 999999)).rejects.toBeInstanceOf(UserError);
    await drawTeams(db, edition.id);
    await startEdition(db, edition.id);
    await expect(removeEntry(db, after.entries[0].id)).rejects.toThrow(
      "tabela já foi gerada",
    );
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
    for (const m of (await view(editionId)).matches.filter(
      (x) => x.stage === "grupo",
    )) {
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
    expect(
      v.matches.filter((m) => m.stage === "mata" && m.round === 1),
    ).toHaveLength(2);
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
    expect(ko.filter((m) => m.stage === "mata" && m.round === 1)).toHaveLength(
      4,
    );
    expect(ko.filter((m) => m.stage === "mata" && m.round === 2)).toHaveLength(
      2,
    );
    expect(ko).toHaveLength(8);
    expect(ko.every((m) => m.homeScore == null)).toBe(true);
    // as quartas já saem preenchidas com a classificação dos grupos
    expect(
      ko
        .filter((m) => m.round === 1)
        .every((m) => m.homeEntryId && m.awayEntryId),
    ).toBe(true);

    await playEverything(editionId);
    v = await view(editionId);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.filter((e) => e.result === "quartas")).toHaveLength(4);
    expect(v.entries.filter((e) => e.result === "campeao")).toHaveLength(1);
  });

  it("também dá para diminuir as fases e tirar o 3º lugar", async () => {
    await setKnockoutPhases(db, editionId, {
      qualifiers: 2,
      thirdPlace: false,
    });
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
      config: {
        ...baseEdition.config,
        format: "liga",
        groupsCount: 1,
        qualifiers: 0,
      },
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
    expect(
      v.matches
        .filter((m) => m.stage === "grupo")
        .every((m) => m.homeScore != null),
    ).toBe(true);
  });
});

describe("torneio só com os jogadores, sem times", () => {
  it("cria, gera a tabela e termina sem nenhum time", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Só os jogadores",
      number: 60,
      useTeams: false,
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS, // ignorada: a edição não usa times
    });
    expect(edition.useTeams).toBe(false);
    expect(edition.teamPool).toEqual([]);

    await expect(drawTeams(db, edition.id)).rejects.toThrow("sem times");
    const v = await view(edition.id);
    await expect(setEntryTeam(db, v.entries[0].id, "Íbis")).rejects.toThrow(
      "sem times",
    );

    // gera a tabela sem sorteio de times
    await startEdition(db, edition.id);
    await playEverything(edition.id);
    const done = await view(edition.id);
    expect(done.edition.status).toBe("encerrada");
    expect(done.entries.every((e) => e.team == null)).toBe(true);
    expect(done.entries.filter((e) => e.result === "campeao")).toHaveLength(1);
  });

  it("as edições com times continuam exigindo o sorteio", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Com times",
      number: 61,
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS,
    });
    expect(edition.useTeams).toBe(true);
    await expect(startEdition(db, edition.id)).rejects.toThrow("sem time");
  });

  it("ao desligar os times antes de gerar, os vínculos são desfeitos", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Desistiu dos times",
      number: 62,
      playerIds: playerIds.slice(0, 4),
      teamPool: TEAMS,
    });
    await drawTeams(db, edition.id);
    expect((await view(edition.id)).entries.every((e) => e.team != null)).toBe(
      true,
    );

    await updateEdition(db, edition.id, {
      name: edition.name,
      number: edition.number,
      game: edition.game,
      playedOn: edition.playedOn,
      useTeams: false,
      config: baseEdition.config,
    });
    const v = await view(edition.id);
    expect(v.edition.useTeams).toBe(false);
    expect(v.edition.teamPool).toEqual([]);
    expect(v.entries.every((e) => e.team == null)).toBe(true);
    await startEdition(db, edition.id);
    expect((await view(edition.id)).edition.status).toBe("andamento");
  });
});

describe("avatar do jogador", () => {
  it("guarda a aparência escolhida, valida e volta ao automático", async () => {
    const player = await createPlayer(db, "Jogador de Avatar");
    const look = { skin: 2, hair: 1, style: 3, shirt: 5 };

    await updatePlayer(db, player.id, {
      name: player.name,
      photoUrl: "",
      avatar: look,
    });
    let saved = (await loadAll(db)).players.find((p) => p.id === player.id)!;
    expect(saved.avatar).toEqual(look);

    // sem informar o avatar, ele não muda
    await updatePlayer(db, player.id, {
      name: "Jogador de Avatar 2",
      photoUrl: "",
    });
    saved = (await loadAll(db)).players.find((p) => p.id === player.id)!;
    expect(saved.name).toBe("Jogador de Avatar 2");
    expect(saved.avatar).toEqual(look);

    // valores fora das listas são recusados e nada muda
    for (const bad of [
      { ...look, skin: 9 },
      { ...look, style: -1 },
      { skin: 1 },
      "texto",
      7,
    ]) {
      await expect(
        updatePlayer(db, player.id, {
          name: saved.name,
          photoUrl: "",
          avatar: bad,
        }),
      ).rejects.toBeInstanceOf(UserError);
    }
    expect(
      (await loadAll(db)).players.find((p) => p.id === player.id)!.avatar,
    ).toEqual(look);

    await updatePlayer(db, player.id, {
      name: saved.name,
      photoUrl: "",
      avatar: null,
    });
    expect(
      (await loadAll(db)).players.find((p) => p.id === player.id)!.avatar,
    ).toBeNull();
  });
});

describe("foto enviada do jogador", () => {
  // PNG de 1x1 pixel
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const find = async (id: number) =>
    (await loadAll(db)).players.find((p) => p.id === id)!;

  it("guarda a foto no cadastro e aponta o jogador para ela", async () => {
    const player = await createPlayer(db, "Jogador com Foto", "", PNG);
    expect(player.photoUrl).toMatch(/^\/foto\/\d+\?v=\d+$/);
    const photo = await getPlayerPhoto(db, player.id);
    expect(photo?.contentType).toBe("image/png");
    expect(Buffer.from(photo!.data, "base64").subarray(1, 4).toString()).toBe(
      "PNG",
    );
  });

  it("link vazio não apaga a foto; remover e link novo apagam", async () => {
    const player = await createPlayer(db, "Jogador Foto 2", "", PNG);
    // salvar o formulário sem mexer na foto
    await updatePlayer(db, player.id, { name: player.name, photoUrl: "" });
    expect((await find(player.id)).photoUrl).toBe(player.photoUrl);
    expect(await getPlayerPhoto(db, player.id)).not.toBeNull();

    // trocar por outra foto
    await updatePlayer(db, player.id, {
      name: player.name,
      photoUrl: "",
      photoData: PNG,
    });
    expect((await find(player.id)).photoUrl).toMatch(/^\/foto\//);

    // remover
    await updatePlayer(db, player.id, {
      name: player.name,
      photoUrl: "",
      removePhoto: true,
    });
    expect((await find(player.id)).photoUrl).toBeNull();
    expect(await getPlayerPhoto(db, player.id)).toBeNull();

    // link externo no lugar de uma foto enviada
    await updatePlayer(db, player.id, {
      name: player.name,
      photoUrl: "",
      photoData: PNG,
    });
    await updatePlayer(db, player.id, {
      name: player.name,
      photoUrl: "https://exemplo.com/a.jpg",
    });
    expect((await find(player.id)).photoUrl).toBe("https://exemplo.com/a.jpg");
    expect(await getPlayerPhoto(db, player.id)).toBeNull();
  });

  it("link de foto novo só aceita https; um http antigo continua valendo até trocar", async () => {
    await expect(
      createPlayer(db, "Link Http", "http://exemplo.com/a.jpg"),
    ).rejects.toThrow(/https:\/\//);
    const player = await createPlayer(
      db,
      "Link Https",
      "https://exemplo.com/a.jpg",
    );
    expect(player.photoUrl).toBe("https://exemplo.com/a.jpg");
    await expect(
      updatePlayer(db, player.id, {
        name: player.name,
        photoUrl: "http://exemplo.com/b.jpg",
      }),
    ).rejects.toThrow(/https:\/\//);

    // um link http que já estava salvo não impede de mudar o nome
    await db
      .update(players)
      .set({ photoUrl: "http://antigo.com/a.jpg" })
      .where(eq(players.id, player.id));
    await updatePlayer(db, player.id, {
      name: "Link Https 2",
      photoUrl: "http://antigo.com/a.jpg",
    });
    expect((await find(player.id)).name).toBe("Link Https 2");
  });

  it("recusa arquivos que não são imagem e fotos grandes, sem criar o jogador", async () => {
    const fake =
      "data:image/png;base64," +
      Buffer.from("isto não é uma imagem").toString("base64");
    await expect(
      createPlayer(db, "Jogador Falso", "", fake),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      createPlayer(db, "Jogador Falso", "", "texto qualquer"),
    ).rejects.toBeInstanceOf(UserError);
    const big =
      "data:image/jpeg;base64," +
      Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.alloc(400_000),
      ]).toString("base64");
    await expect(createPlayer(db, "Jogador Falso", "", big)).rejects.toThrow(
      "grande demais",
    );
    expect(
      (await loadAll(db)).players.some((p) => p.name === "Jogador Falso"),
    ).toBe(false);
  });

  it("excluir o jogador leva a foto junto", async () => {
    const player = await createPlayer(db, "Jogador Temporário", "", PNG);
    await deletePlayer(db, player.id);
    expect(await getPlayerPhoto(db, player.id)).toBeNull();
  });
});

describe("acesso do jogador ao próprio perfil", () => {
  it("o link identifica o jogador; gerar outro invalida o anterior", async () => {
    const a = await createPlayer(db, "Jogador Acesso A");
    const b = await createPlayer(db, "Jogador Acesso B");
    expect(await playerHasAccess(db, a.id)).toBe(false);

    const first = await createPlayerAccess(db, a.id);
    const other = await createPlayerAccess(db, b.id);
    expect(first).not.toBe(other);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect((await findPlayerByAccessToken(db, first))?.id).toBe(a.id);
    expect((await findPlayerByAccessToken(db, other))?.id).toBe(b.id);
    expect(await playerHasAccess(db, a.id)).toBe(true);

    const second = await createPlayerAccess(db, a.id);
    expect(await findPlayerByAccessToken(db, first)).toBeUndefined();
    expect((await findPlayerByAccessToken(db, second))?.id).toBe(a.id);
    expect((await findPlayerByAccessToken(db, other))?.id).toBe(b.id);
  });

  it("não guarda o link em si e não o expõe nas listas", async () => {
    const p = await createPlayer(db, "Jogador Acesso Hash");
    const token = await createPlayerAccess(db, p.id);
    const hash = await getPlayerAccessHash(db, p.id);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    const listed = (await loadAll(db)).players.find((x) => x.id === p.id)!;
    expect(listed).not.toHaveProperty("accessHash");
  });

  it("desativar o acesso derruba o link; código inválido não acha ninguém", async () => {
    const p = await createPlayer(db, "Jogador Acesso Revogado");
    const token = await createPlayerAccess(db, p.id);
    await revokePlayerAccess(db, p.id);
    expect(await findPlayerByAccessToken(db, token)).toBeUndefined();
    expect(await playerHasAccess(db, p.id)).toBe(false);
    expect(await getPlayerAccessHash(db, p.id)).toBeNull();
    for (const bad of ["", "abc", "x".repeat(200)]) {
      expect(await findPlayerByAccessToken(db, bad)).toBeUndefined();
    }
    await expect(createPlayerAccess(db, 999999)).rejects.toBeInstanceOf(
      UserError,
    );
  });

  it("o jogador troca foto e avatar, mas não o nome", async () => {
    const p = await createPlayer(db, "Jogador Perfil Próprio");
    const look = { skin: 1, hair: 2, style: 0, shirt: 3 };
    await updatePlayerProfile(db, p.id, { photoUrl: "", avatar: look });
    const saved = (await loadAll(db)).players.find((x) => x.id === p.id)!;
    expect(saved.name).toBe("Jogador Perfil Próprio");
    expect(saved.avatar).toEqual(look);

    await expect(
      updatePlayerProfile(db, p.id, { photoUrl: "", avatar: { skin: 99 } }),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      updatePlayerProfile(db, 999999, { photoUrl: "" }),
    ).rejects.toBeInstanceOf(UserError);
  });
});

describe("juntar times", () => {
  const cfg = {
    format: "manual" as const,
    groupsCount: 0,
    legs: 1,
    pairing: "interno" as const,
    crossGames: 0,
    qualifiers: 0,
    thirdPlace: false,
  };
  it("passa participantes e listas de sorteio para o time certo e apaga o errado", async () => {
    const a = await createPlayer(db, "Junta A");
    const b = await createPlayer(db, "Junta B");
    const e1 = await createEdition(db, {
      name: "Junta #1",
      number: 901,
      game: "FIFA",
      playedOn: "2026-01-01",
      config: cfg,
      playerIds: [a.id, b.id],
      teamPool: ["Al Hilan", "Íbis"],
    });
    const e2 = await createEdition(db, {
      name: "Junta #2",
      number: 902,
      game: "FIFA",
      playedOn: "2026-02-01",
      config: cfg,
      playerIds: [a.id],
      teamPool: ["Al Hilal", "Al Hilan"],
    });
    const v1 = editionView(await loadAll(db), e1.id)!;
    const v2 = editionView(await loadAll(db), e2.id)!;
    await setEntryTeam(
      db,
      v1.entries.find((x) => x.playerId === a.id)!.id,
      "Al Hilan",
    );
    await setEntryTeam(db, v2.entries[0].id, "Al Hilal");
    let all = await loadAll(db);
    const wrong = all.teams.find((t) => t.name === "Al Hilan")!;
    const right = all.teams.find((t) => t.name === "Al Hilal")!;

    await expect(mergeTeams(db, wrong.id, wrong.id)).rejects.toBeInstanceOf(
      UserError,
    );
    expect(await mergeTeams(db, wrong.id, right.id)).toEqual({
      from: "Al Hilan",
      into: "Al Hilal",
    });

    all = await loadAll(db);
    expect(all.teams.some((t) => t.name === "Al Hilan")).toBe(false);
    expect(
      editionView(all, e1.id)!.entries.find((x) => x.playerId === a.id)!.team
        ?.name,
    ).toBe("Al Hilal");
    expect(all.editions.find((e) => e.id === e1.id)!.teamPool).toEqual([
      "Al Hilal",
      "Íbis",
    ]);
    expect(all.editions.find((e) => e.id === e2.id)!.teamPool).toEqual([
      "Al Hilal",
    ]);
  });

  it("recusa quando os dois times estão com participantes na mesma edição", async () => {
    const a = await createPlayer(db, "Junta C");
    const b = await createPlayer(db, "Junta D");
    const e = await createEdition(db, {
      name: "Junta #3",
      number: 903,
      game: "FIFA",
      playedOn: "2026-03-01",
      config: cfg,
      playerIds: [a.id, b.id],
      teamPool: [],
    });
    const v = editionView(await loadAll(db), e.id)!;
    await setEntryTeam(db, v.entries[0].id, "Time X");
    await setEntryTeam(db, v.entries[1].id, "Time Y");
    const all = await loadAll(db);
    const x = all.teams.find((t) => t.name === "Time X")!;
    const y = all.teams.find((t) => t.name === "Time Y")!;
    await expect(mergeTeams(db, x.id, y.id)).rejects.toThrow(/Junta #3/);
    expect((await loadAll(db)).teams.some((t) => t.id === x.id)).toBe(true);
  });
});

describe("apagar times sem uso", () => {
  it("apaga só os times que nenhum participante usa", async () => {
    const cfg = {
      format: "manual" as const,
      groupsCount: 0,
      legs: 1,
      pairing: "interno" as const,
      crossGames: 0,
      qualifiers: 0,
      thirdPlace: false,
    };
    const p = await createPlayer(db, "Sem Uso A");
    const e = await createEdition(db, {
      name: "Sem uso #1",
      number: 950,
      game: "FIFA",
      playedOn: "2026-05-01",
      config: cfg,
      playerIds: [p.id],
      teamPool: [],
    });
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Time Em Uso",
    );
    // vira time sem uso: participante troca de time
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Time Trocado",
    );
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Time Em Uso",
    );

    const removed = await deleteUnusedTeams(db);
    expect(removed).toContain("Time Trocado");
    expect(removed).not.toContain("Time Em Uso");
    const all = await loadAll(db);
    const usedIds = new Set(
      all.entries.map((x) => x.teamId).filter((x) => x != null),
    );
    expect(all.teams.every((t) => usedIds.has(t.id))).toBe(true);
    expect(await deleteUnusedTeams(db)).toEqual([]);
  });
});

describe("gerenciar times", () => {
  const cfg = {
    format: "manual" as const,
    groupsCount: 0,
    legs: 1,
    pairing: "interno" as const,
    crossGames: 0,
    qualifiers: 0,
    thirdPlace: false,
  };
  it("renomeia em todo lugar e recusa nome de outro time", async () => {
    const p = await createPlayer(db, "Renomeia A");
    const e = await createEdition(db, {
      name: "Renomeia #1",
      number: 960,
      game: "FIFA",
      playedOn: "2026-06-01",
      config: cfg,
      playerIds: [p.id],
      teamPool: ["Flamengo Errado", "Outro"],
    });
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Flamengo Errado",
    );
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Flamengo Errado",
    );
    let all = await loadAll(db);
    const t = all.teams.find((x) => x.name === "Flamengo Errado")!;
    await renameTeam(db, t.id, "  Flamengo  ");
    all = await loadAll(db);
    expect(all.teams.find((x) => x.id === t.id)!.name).toBe("Flamengo");
    expect(editionView(all, e.id)!.entries[0].team?.name).toBe("Flamengo");
    expect(all.editions.find((x) => x.id === e.id)!.teamPool).toEqual([
      "Flamengo",
      "Outro",
    ]);
    await setEntryTeam(db, editionView(all, e.id)!.entries[0].id, "Outro");
    const outro = (await loadAll(db)).teams.find((x) => x.name === "Outro")!;
    await expect(renameTeam(db, outro.id, "flamengo")).rejects.toThrow(
      /Juntar times/,
    );
    await expect(renameTeam(db, outro.id, "")).rejects.toBeInstanceOf(
      UserError,
    );
  });

  it("só apaga time sem uso", async () => {
    const p = await createPlayer(db, "Apaga A");
    const e = await createEdition(db, {
      name: "Apaga #1",
      number: 961,
      game: "FIFA",
      playedOn: "2026-07-01",
      config: cfg,
      playerIds: [p.id],
      teamPool: [],
    });
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Usado FC",
    );
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Largado FC",
    );
    await setEntryTeam(
      db,
      editionView(await loadAll(db), e.id)!.entries[0].id,
      "Usado FC",
    );
    const all = await loadAll(db);
    const usado = all.teams.find((x) => x.name === "Usado FC")!;
    const largado = all.teams.find((x) => x.name === "Largado FC")!;
    await expect(deleteTeam(db, usado.id)).rejects.toThrow(
      /não pode ser apagado/,
    );
    await deleteTeam(db, largado.id);
    expect((await loadAll(db)).teams.some((x) => x.id === largado.id)).toBe(
      false,
    );
  });
});

describe("repescagem", () => {
  it("organizador escolhe a repescagem e o vencedor vai para o mata-mata", async () => {
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Com repescagem",
      number: 40,
      config: {
        ...baseEdition.config,
        qualifiers: 4,
        playoffs: 2,
        thirdPlace: false,
      },
      playerIds: playerIds.slice(0, 8),
      teamPool: TEAMS,
    });
    const id = edition.id;
    expect(
      (await loadAll(db)).editions.find((e) => e.id === id)!.playoffs,
    ).toBe(2);
    await drawTeams(db, id);
    await startEdition(db, id);

    // fase de grupos inteira
    let v = await view(id);
    for (const m of v.matches.filter((x) => x.stage === "grupo")) {
      await saveMatchResult(db, m.id, { homeScore: 2, awayScore: 1 });
    }
    v = await view(id);
    const playoffs = v.matches
      .filter((m) => m.stage === "repescagem")
      .sort((a, b) => a.slot - b.slot);
    expect(playoffs).toHaveLength(2);
    expect(playoffs[0].homeEntryId).toBeNull();

    // quem já tem vaga direta não entra; escolhe 4 dos outros
    const direct = new Set(
      v.matches
        .filter((m) => m.stage === "mata" && m.round === 1)
        .flatMap((m) => [m.homeEntryId, m.awayEntryId])
        .filter((x) => x != null),
    );
    expect(direct.size).toBe(2);
    const others = v.entries.map((e) => e.id).filter((e) => !direct.has(e));
    const [a, b, c, d] = others;
    await setKnockoutSlots(db, id, [
      { matchId: playoffs[0].id, side: "home", entryId: a },
      { matchId: playoffs[0].id, side: "away", entryId: b },
      { matchId: playoffs[1].id, side: "home", entryId: c },
      { matchId: playoffs[1].id, side: "away", entryId: d },
    ]);
    // quem tem vaga direta não entra na repescagem
    const [someDirect] = [...direct];
    await expect(
      setKnockoutSlots(db, id, [
        { matchId: playoffs[0].id, side: "home", entryId: someDirect! },
      ]),
    ).rejects.toThrow(/vaga direta/);
    // o mesmo jogador não pode estar nos dois jogos da repescagem
    await expect(
      setKnockoutSlots(db, id, [
        { matchId: playoffs[1].id, side: "away", entryId: a },
      ]),
    ).rejects.toBeInstanceOf(UserError);

    await saveMatchResult(db, playoffs[0].id, { homeScore: 0, awayScore: 2 }); // b vence
    await saveMatchResult(db, playoffs[1].id, {
      homeScore: 1,
      awayScore: 1,
      homePens: 5,
      awayPens: 4,
    }); // c vence
    v = await view(id);
    const semis = v.matches.filter((m) => m.stage === "mata" && m.round === 1);
    const inSemis = new Set(
      semis.flatMap((m) => [m.homeEntryId, m.awayEntryId]),
    );
    expect(inSemis.has(b)).toBe(true);
    expect(inSemis.has(c)).toBe(true);
    expect(inSemis.has(a)).toBe(false);

    await playEverything(id);
    v = await view(id);
    expect(v.edition.status).toBe("encerrada");
    expect(v.entries.filter((e) => e.result === "campeao")).toHaveLength(1);
  });
});

describe("escolha dos times (citar e banir)", () => {
  it("cada um cita 2, cada um bane 1 e sobra um time por jogador", async () => {
    const [a, b, c] = playerIds;
    const edition = await createEdition(db, {
      ...baseEdition,
      name: "Copinha da escolha",
      number: 70,
      config: { ...baseEdition.config, format: "liga", groupsCount: 0, qualifiers: 0 },
      playerIds: [a, b, c],
    });
    const id = edition.id;
    const state = async () =>
      choiceState([a, b, c], await listTeamChoices(db, id));

    // banir antes de todos citarem não pode
    await expect(banTeam(db, id, a, "Íbis")).rejects.toThrow(/banimento começa/);

    await addTeamPick(db, id, a, "Íbis");
    // mesmo time, sem acento: já citado
    await expect(addTeamPick(db, id, b, "ibis")).rejects.toThrow(/já foi citado por Ronaldo/);
    await addTeamPick(db, id, a, "Tabajara");
    await expect(addTeamPick(db, id, a, "Bangu")).rejects.toThrow(/já citou 2/);
    await addTeamPick(db, id, b, "Bangu");
    await addTeamPick(db, id, b, "Olaria");
    await addTeamPick(db, id, c, "Andorra");
    // desfazer uma escolha enquanto ninguém baniu
    const last = (await listTeamChoices(db, id)).at(-1)!;
    await removeTeamChoice(db, last.id);
    await addTeamPick(db, id, c, "Gibraltar");
    await addTeamPick(db, id, c, "San Marino");
    expect((await state()).phase).toBe("banimento");
    await expect(addTeamPick(db, id, c, "Liechtenstein")).rejects.toBeInstanceOf(UserError);

    // pode banir qualquer citado, inclusive o próprio
    await banTeam(db, id, a, "tabajara");
    await expect(banTeam(db, id, b, "Tabajara")).rejects.toThrow(/já foi banido por Ronaldo/);
    await expect(banTeam(db, id, a, "Bangu")).rejects.toThrow(/já baniu/);
    await expect(banTeam(db, id, b, "Flamengo")).rejects.toThrow(/times citados/);
    // trocar time citado depois do banimento começar não pode
    const pick = (await listTeamChoices(db, id)).find((r) => r.team === "Bangu")!;
    await expect(removeTeamChoice(db, pick.id)).rejects.toThrow(/Desfaça os banimentos/);
    await banTeam(db, id, b, "Gibraltar");
    await banTeam(db, id, c, "Olaria");

    const done = await state();
    expect(done.phase).toBe("concluida");
    expect(done.remaining).toEqual(["Íbis", "Bangu", "San Marino"]);
    // o que sobrou vira a lista do sorteio
    expect((await view(id)).edition.teamPool).toEqual(["Íbis", "Bangu", "San Marino"]);
    const draw = await drawTeams(db, id);
    expect(new Set(draw.map((d) => d.teamName))).toEqual(new Set(["Íbis", "Bangu", "San Marino"]));

    await resetTeamChoices(db, id);
    expect(await listTeamChoices(db, id)).toHaveLength(0);
  });
});

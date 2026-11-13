import { describe, expect, it } from "vitest";
import {
  bracketOrder,
  computeResults,
  computeStandings,
  countMatches,
  groupGamesPerEntry,
  planMatches,
  resolveKnockout,
  roundRobin,
  standingsByGroup,
  validateConfig,
  type EntryLike,
  type FormatConfig,
  type MatchLike,
} from "@/lib/tournament";

const cfg = (c: Partial<FormatConfig>): FormatConfig => ({
  format: "grupos",
  groupsCount: 2,
  legs: 1,
  pairing: "interno",
  crossGames: 0,
  qualifiers: 4,
  thirdPlace: true,
  ...c,
});

function materialize(config: FormatConfig, entries: EntryLike[]): MatchLike[] {
  return planMatches(config, entries).map((m, i) => ({
    ...m,
    id: i + 1,
    homeScore: null,
    awayScore: null,
    homePens: null,
    awayPens: null,
  }));
}

function eightInTwoGroups(): EntryLike[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    seed: i,
    groupLabel: i % 2 === 0 ? "A" : "B",
  }));
}

/** Joga tudo: o participante de menor id sempre vence por 2 a 0. */
function playAll(entries: EntryLike[], initial: MatchLike[]) {
  let matches = initial;
  for (let guard = 0; guard < 50; guard++) {
    matches = resolveKnockout(entries, matches).matches;
    const next = matches.find(
      (m) => m.homeScore == null && m.homeEntryId != null && m.awayEntryId != null,
    );
    if (!next) break;
    const homeWins = next.homeEntryId! < next.awayEntryId!;
    next.homeScore = homeWins ? 2 : 0;
    next.awayScore = homeWins ? 0 : 2;
  }
  return resolveKnockout(entries, matches).matches;
}

describe("roundRobin", () => {
  it.each([3, 4, 5, 8])("todos se enfrentam uma vez com %i", (n) => {
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    const games = roundRobin(ids, 1);
    expect(games).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(
      games.map((g) => [g.home, g.away].sort((a, b) => a - b).join("-")),
    );
    expect(pairs.size).toBe(games.length);
    // ninguém joga duas vezes na mesma rodada
    for (const round of new Set(games.map((g) => g.round))) {
      const playing = games
        .filter((g) => g.round === round)
        .flatMap((g) => [g.home, g.away]);
      expect(new Set(playing).size).toBe(playing.length);
    }
  });

  it("ida e volta dobra os jogos invertendo o mando", () => {
    const games = roundRobin([1, 2, 3, 4], 2);
    expect(games).toHaveLength(12);
    const first = games[0];
    expect(
      games.some((g) => g.home === first.away && g.away === first.home),
    ).toBe(true);
  });
});

describe("validateConfig", () => {
  it("aceita os formatos comuns com 8 participantes", () => {
    expect(validateConfig(cfg({}), 8)).toBeNull();
    expect(validateConfig(cfg({ format: "mata" }), 8)).toBeNull();
    expect(validateConfig(cfg({ format: "liga", qualifiers: 2 }), 8)).toBeNull();
    expect(validateConfig(cfg({ format: "liga", qualifiers: 0 }), 8)).toBeNull();
  });

  it("recusa configurações impossíveis", () => {
    expect(validateConfig(cfg({ qualifiers: 3 }), 8)).toBeTruthy();
    expect(validateConfig(cfg({ groupsCount: 4, qualifiers: 2 }), 8)).toBeTruthy();
    expect(validateConfig(cfg({ groupsCount: 5 }), 8)).toBeTruthy();
    expect(validateConfig(cfg({ format: "liga", qualifiers: 16 }), 8)).toBeTruthy();
    expect(validateConfig(cfg({ format: "mata" }), 1)).toBeTruthy();
  });

  it("conta os jogos gerados", () => {
    expect(countMatches(cfg({}), 8)).toEqual({ group: 12, knockout: 4 });
    expect(countMatches(cfg({ format: "mata" }), 8)).toEqual({
      group: 0,
      knockout: 8,
    });
    expect(
      countMatches(cfg({ format: "liga", qualifiers: 2, legs: 2 }), 8),
    ).toEqual({ group: 56, knockout: 1 });
  });
});

describe("confrontos entre grupos", () => {
  const groupOf = (id: number) => (id % 2 === 1 ? "A" : "B");
  const groupGames = (config: FormatConfig) =>
    materialize(config, eightInTwoGroups()).filter((m) => m.stage === "grupo");

  it("cruzado: cada um enfrenta todos do outro grupo e ninguém do próprio", () => {
    const games = groupGames(cfg({ pairing: "cruzado" }));
    expect(games).toHaveLength(16);
    for (const g of games)
      expect(groupOf(g.homeEntryId!)).not.toBe(groupOf(g.awayEntryId!));
    const pairs = new Set(
      games.map((g) =>
        [g.homeEntryId, g.awayEntryId].sort((a, b) => a! - b!).join("-"),
      ),
    );
    expect(pairs.size).toBe(16);
    // 4 rodadas, com cada participante jogando uma vez em cada
    for (let round = 1; round <= 4; round++) {
      const playing = games
        .filter((g) => g.round === round)
        .flatMap((g) => [g.homeEntryId, g.awayEntryId]);
      expect(new Set(playing).size).toBe(8);
    }
  });

  it("misto: joga dentro do grupo e depois contra o outro", () => {
    const games = groupGames(cfg({ pairing: "misto" }));
    expect(games).toHaveLength(12 + 16);
    const sameGroup = (g: MatchLike) =>
      groupOf(g.homeEntryId!) === groupOf(g.awayEntryId!);
    expect(games.filter((g) => g.round <= 3).every(sameGroup)).toBe(true);
    expect(games.filter((g) => g.round > 3).some(sameGroup)).toBe(false);
    expect(countMatches(cfg({ pairing: "misto", legs: 2 }), 8)).toEqual({
      group: 56,
      knockout: 4,
    });
  });

  it("misto com quantidade definida: cada um faz só N jogos contra o outro grupo", () => {
    const config = cfg({ pairing: "misto", crossGames: 2 });
    const games = groupGames(config);
    expect(games).toHaveLength(12 + 8);
    const cross = games.filter(
      (g) => groupOf(g.homeEntryId!) !== groupOf(g.awayEntryId!),
    );
    expect(cross).toHaveLength(8);
    for (let id = 1; id <= 8; id++) {
      const mine = (list: MatchLike[]) =>
        list.filter((g) => g.homeEntryId === id || g.awayEntryId === id);
      expect(mine(cross)).toHaveLength(2);
      // adversários diferentes
      expect(
        new Set(mine(cross).map((g) => g.homeEntryId! + g.awayEntryId! - id)).size,
      ).toBe(2);
      expect(mine(games)).toHaveLength(5);
    }
    expect(groupGamesPerEntry(config, 8)).toEqual({ min: 5, max: 5 });
    expect(countMatches({ ...config, legs: 2 }, 8)).toEqual({
      group: 24 + 16,
      knockout: 4,
    });
    // pedir mais do que o grupo tem equivale a "todos"
    expect(countMatches(cfg({ pairing: "misto", crossGames: 9 }), 8).group).toBe(28);
    // fora do misto a quantidade é ignorada
    expect(countMatches(cfg({ pairing: "cruzado", crossGames: 2 }), 8).group).toBe(16);
  });

  it("quantidade definida exige grupos do mesmo tamanho", () => {
    expect(validateConfig(cfg({ pairing: "misto", crossGames: 2 }), 9)).toBeTruthy();
    expect(validateConfig(cfg({ pairing: "misto", crossGames: 0 }), 9)).toBeNull();
    expect(validateConfig(cfg({ pairing: "misto", crossGames: 2 }), 10)).toBeNull();
    // 4 grupos com 14: A e B têm 4, C e D têm 3, e os pares continuam iguais
    expect(
      validateConfig(cfg({ groupsCount: 4, pairing: "misto", crossGames: 2 }), 14),
    ).toBeNull();
    expect(
      validateConfig(cfg({ groupsCount: 4, pairing: "misto", crossGames: 2 }), 13),
    ).toBeTruthy();
  });

  it("grupos de tamanhos diferentes: todos se cruzam uma vez", () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      seed: i,
      groupLabel: i % 2 === 0 ? "A" : "B",
    }));
    const games = materialize(cfg({ pairing: "cruzado" }), entries).filter(
      (m) => m.stage === "grupo",
    );
    expect(games).toHaveLength(5 * 4);
  });

  it("exige número par de grupos", () => {
    const three = cfg({ groupsCount: 3, qualifiers: 4, pairing: "cruzado" });
    expect(validateConfig(three, 12)).toBeTruthy();
    expect(validateConfig({ ...three, pairing: "interno" }, 12)).toBeNull();
    expect(validateConfig(cfg({ groupsCount: 4, pairing: "misto" }), 12)).toBeNull();
  });

  it("a classificação segue por grupo, contando os jogos contra o outro", () => {
    const entries = eightInTwoGroups();
    const config = cfg({ pairing: "cruzado" });
    const matches = playAll(entries, materialize(config, entries));
    const tables = standingsByGroup(entries, matches);
    expect(tables.map((t) => t.rows.map((r) => r.entryId))).toEqual([
      [1, 3, 5, 7],
      [2, 4, 6, 8],
    ]);
    expect(tables[0].rows.every((r) => r.played === 4)).toBe(true);
    // menor id vence: o 1 ganha os 4 jogos, o 8 perde os 4
    expect(tables[0].rows[0].points).toBe(12);
    expect(tables[1].rows[3].points).toBe(0);
    const { finished, results } = computeResults(config, entries, matches);
    expect(finished).toBe(true);
    expect(results.get(1)).toBe("campeao");
  });
});

describe("chaveamento", () => {
  it("usa a ordem padrão de cabeças de chave", () => {
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("cruza os grupos nas semifinais", () => {
    const matches = materialize(cfg({}), eightInTwoGroups());
    const semis = matches.filter((m) => m.stage === "mata" && m.round === 1);
    expect(semis.map((m) => [m.homeSource, m.awaySource])).toEqual([
      ["G:A:1", "G:B:2"],
      ["G:B:1", "G:A:2"],
    ]);
    expect(matches.filter((m) => m.stage === "terceiro")).toHaveLength(1);
  });

  it("dá folga aos melhores cabeças quando não fecha potência de 2", () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      seed: i,
      groupLabel: null,
    }));
    const matches = materialize(cfg({ format: "mata" }), entries);
    const first = matches.filter((m) => m.stage === "mata" && m.round === 1);
    expect(first).toHaveLength(2);
    const semis = matches.filter((m) => m.stage === "mata" && m.round === 2);
    // cabeças 1 e 2 já entram direto nas semifinais
    expect(semis.map((m) => m.homeEntryId)).toEqual([1, 2]);
    expect(matches.filter((m) => m.round === 3 && m.stage === "mata")).toHaveLength(1);
  });
});

describe("classificação", () => {
  it("desempata no confronto direto", () => {
    const entries: EntryLike[] = [1, 2, 3].map((id) => ({
      id,
      seed: id,
      groupLabel: "A",
    }));
    const game = (
      id: number,
      home: number,
      away: number,
      hs: number,
      as: number,
    ): MatchLike => ({
      id,
      stage: "grupo",
      round: 1,
      slot: id,
      groupLabel: "A",
      homeEntryId: home,
      awayEntryId: away,
      homeSource: null,
      awaySource: null,
      homeScore: hs,
      awayScore: as,
      homePens: null,
      awayPens: null,
    });
    // 1 e 2 terminam iguais em pontos, vitórias, saldo e gols; 2 venceu o confronto.
    const table = computeStandings(entries, [
      game(1, 2, 1, 1, 0),
      game(2, 1, 3, 2, 0),
      game(3, 3, 2, 1, 0),
      game(4, 1, 3, 1, 0),
      game(5, 2, 3, 2, 0),
    ]);
    expect(table.map((r) => r.entryId)).toEqual([2, 1, 3]);
    expect(table[0].points).toBe(6);
    expect(table[1].points).toBe(6);
  });
});

describe("edição completa", () => {
  it("grupos + mata-mata: define pódio e fase de cada um", () => {
    const entries = eightInTwoGroups();
    const config = cfg({});
    const matches = playAll(entries, materialize(config, entries));
    expect(matches.every((m) => m.homeScore != null)).toBe(true);

    const { finished, results } = computeResults(config, entries, matches);
    expect(finished).toBe(true);
    // menor id sempre vence: grupo A = 1,3,5,7 e grupo B = 2,4,6,8
    expect(results.get(1)).toBe("campeao");
    expect(results.get(2)).toBe("vice");
    expect(results.get(3)).toBe("terceiro");
    expect(results.get(4)).toBe("quarto");
    for (const id of [5, 6, 7, 8]) expect(results.get(id)).toBe("grupos");
  });

  it("não encerra enquanto a final não foi jogada", () => {
    const entries = eightInTwoGroups();
    const config = cfg({});
    const matches = playAll(entries, materialize(config, entries));
    const final = matches.find((m) => m.stage === "mata" && m.round === 2)!;
    final.homeScore = final.awayScore = null;
    expect(computeResults(config, entries, matches).finished).toBe(false);
  });

  it("empate no mata-mata só decide com pênaltis", () => {
    const entries = [1, 2].map((id) => ({ id, seed: id, groupLabel: null }));
    const config = cfg({ format: "mata", thirdPlace: false });
    const matches = materialize(config, entries);
    matches[0].homeScore = matches[0].awayScore = 1;
    expect(computeResults(config, entries, matches).finished).toBe(false);
    matches[0].homePens = 3;
    matches[0].awayPens = 4;
    const { finished, results } = computeResults(config, entries, matches);
    expect(finished).toBe(true);
    expect(results.get(2)).toBe("campeao");
  });

  it("mudar um resultado anterior desfaz os jogos seguintes", () => {
    const entries = eightInTwoGroups();
    const config = cfg({});
    const matches = playAll(entries, materialize(config, entries));
    const semi = matches.find((m) => m.stage === "mata" && m.round === 1)!;
    // inverte o vencedor da primeira semifinal
    [semi.homeScore, semi.awayScore] = [semi.awayScore, semi.homeScore];
    const { changes, matches: after } = resolveKnockout(entries, matches);
    expect(changes.filter((c) => c.clearScore)).toHaveLength(2);
    const final = after.find((m) => m.stage === "mata" && m.round === 2)!;
    expect(final.homeScore).toBeNull();
    expect(final.homeEntryId).toBe(4);
    expect(computeResults(config, entries, after).finished).toBe(false);
  });

  it("pontos corridos sem final: campeão é o líder", () => {
    const entries = [1, 2, 3, 4].map((id) => ({ id, seed: id, groupLabel: "A" }));
    const config = cfg({ format: "liga", qualifiers: 0 });
    const matches = playAll(entries, materialize(config, entries));
    const { finished, results } = computeResults(config, entries, matches);
    expect(finished).toBe(true);
    expect([1, 2, 3, 4].map((id) => results.get(id))).toEqual([
      "campeao",
      "vice",
      "terceiro",
      "liga",
    ]);
  });

  it("3 grupos com 8 classificados usa os melhores terceiros", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      seed: i,
      groupLabel: "ABC"[i % 3],
    }));
    const config = cfg({ groupsCount: 3, qualifiers: 8 });
    expect(validateConfig(config, 12)).toBeNull();
    const matches = playAll(entries, materialize(config, entries));
    const quarters = matches.filter((m) => m.stage === "mata" && m.round === 1);
    expect(quarters).toHaveLength(4);
    const inKnockout = new Set(
      quarters.flatMap((m) => [m.homeEntryId, m.awayEntryId]),
    );
    expect(inKnockout.size).toBe(8);
    // os 1ºs e 2ºs de cada grupo (ids 1 a 6) e dois dos terceiros (7, 8, 9)
    for (const id of [1, 2, 3, 4, 5, 6]) expect(inKnockout.has(id)).toBe(true);
    expect(computeResults(config, entries, matches).results.get(1)).toBe("campeao");
  });
});

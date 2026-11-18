import { describe, expect, it } from "vitest";
import type { Edition, Entry, Match, Player } from "@/db/schema";
import { computeRecords, type AllData } from "@/lib/stats";

// Dados montados à mão: três jogadores (Ana, Beto, Caio) em duas edições.
const players = ["Ana", "Beto", "Caio"].map(
  (name, i) =>
    ({
      id: i + 1,
      name,
      photoUrl: null,
      avatar: null,
      createdAt: "",
    }) as Player,
);
const edition = (id: number, number: number) =>
  ({
    id,
    number,
    name: `Copinha #${number}`,
    playedOn: `2026-0${number}-01`,
    status: "encerrada",
  }) as Edition;
const editions = [edition(10, 1), edition(20, 2)];

// Inscrição = edição * 10 + jogador (ex.: 101 = Ana na edição 10).
const entries: Entry[] = [];
for (const e of editions)
  for (const p of players)
    entries.push({
      id: e.id * 10 + p.id,
      editionId: e.id,
      playerId: p.id,
      teamId: null,
      groupLabel: null,
      seed: null,
      result: null,
    } as unknown as Entry);
const setResult = (id: number, result: string) => {
  (entries.find((x) => x.id === id) as { result: string | null }).result =
    result;
};
setResult(101, "campeao"); // Ana campeã da #1 (invicta)
setResult(202, "campeao"); // Beto campeão da #2 (perdeu um jogo)
setResult(102, "vice"); // Beto vice na #1
setResult(201, "vice"); // Ana vice na #2

let nextId = 1;
const match = (
  editionId: number,
  home: number,
  away: number,
  hs: number,
  as: number,
  opts: { stage?: string; round?: number; pens?: [number, number] } = {},
) =>
  ({
    id: nextId++,
    editionId,
    stage: opts.stage ?? "grupo",
    round: opts.round ?? nextId,
    slot: 0,
    groupLabel: null,
    homeEntryId: editionId * 10 + home,
    awayEntryId: editionId * 10 + away,
    homeSource: null,
    awaySource: null,
    homeScore: hs,
    awayScore: as,
    homePens: opts.pens?.[0] ?? null,
    awayPens: opts.pens?.[1] ?? null,
    playedAt: null,
  }) as Match;

const matches: Match[] = [
  // Edição 1: Ana não perde; Caio leva de todo mundo.
  match(10, 1, 2, 2, 0),
  match(10, 1, 3, 5, 0),
  match(10, 2, 3, 4, 1),
  match(10, 1, 2, 1, 1, { stage: "mata", round: 99, pens: [5, 4] }), // final nos pênaltis
  // Edição 2: Ana vence Beto de novo, depois perde para Caio.
  match(20, 1, 2, 3, 1),
  match(20, 3, 1, 2, 0),
  match(20, 2, 3, 2, 2, { stage: "mata", round: 99, pens: [3, 1] }),
  match(20, 2, 1, 1, 1, { stage: "mata", round: 100, pens: [4, 3] }),
];

const data: AllData = { players, teams: [], editions, entries, matches };
const records = computeRecords(data);

describe("recordes por jogador", () => {
  it("maior freguesia: Ana 2 x 0 Beto, com dois empates", () => {
    expect(records.rivalry).toMatchObject({
      winner: { name: "Ana" },
      loser: { name: "Beto" },
      wins: 2,
      losses: 0,
      draws: 2,
    });
  });

  it("maior sequência invicta atravessa edições e para na derrota", () => {
    // Ana: 3 jogos na #1 + vitória na #2 = 4, depois perde para Caio.
    expect(records.unbeatenRun).toMatchObject({
      player: { name: "Ana" },
      games: 4,
      from: { number: 1 },
      to: { number: 2 },
    });
  });

  it("campeão invicto: só quem não perdeu nenhum jogo", () => {
    expect(
      records.unbeatenChampions.map((c) => [
        c.player.name,
        c.edition.number,
        c.wins,
        c.draws,
      ]),
    ).toEqual([["Ana", 1, 2, 1]]);
  });

  it("lixo do lixo: Caio na #1, zero pontos e 1 x 9 nos gols", () => {
    expect(records.worstCampaign).toMatchObject({
      player: { name: "Caio" },
      edition: { number: 1 },
      points: 0,
      gf: 1,
      ga: 9,
    });
  });

  it("rei dos pênaltis: Beto venceu 2 de 3 disputas", () => {
    // Ana venceu 1 de 2; Beto 2 de 3; Caio 0 de 1.
    expect(records.penaltyKing).toMatchObject({
      player: { name: "Beto" },
      won: 2,
      total: 3,
    });
  });

  it("sem jogos, nenhum recorde novo aparece", () => {
    const empty = computeRecords({ ...data, matches: [] });
    expect(empty.rivalry).toBeNull();
    expect(empty.unbeatenRun).toBeNull();
    expect(empty.unbeatenChampions).toEqual([]);
    expect(empty.worstCampaign).toBeNull();
    expect(empty.penaltyKing).toBeNull();
    for (const key of [
      "finalRout",
      "finalGoals",
      "longestShootout",
      "goalFest",
      "bestDefense",
      "bestGoalDiff",
      "winStreak",
      "drought",
      "classic",
    ] as const)
      expect(empty[key]).toBeNull();
  });

  it("final com mais gols e disputa de pênaltis mais longa", () => {
    expect(records.finalRout).toBeNull(); // as duas finais empataram
    expect(records.finalGoals).toMatchObject({
      home: { name: "Ana" },
      away: { name: "Beto" },
      homeScore: 1,
      awayScore: 1,
      edition: { number: 1 },
    });
    expect(records.longestShootout).toMatchObject({
      home: { name: "Ana" },
      homePens: 5,
      awayPens: 4,
    });
  });

  it("edição mais goleadora pela média de gols por jogo", () => {
    expect(records.goalFest).toMatchObject({
      edition: { number: 1 },
      games: 4,
      goals: 14,
    });
  });

  it("melhor defesa e maior saldo numa edição", () => {
    expect(records.bestDefense).toMatchObject({
      player: { name: "Ana" },
      edition: { number: 1 },
      played: 3,
      ga: 1,
    });
    expect(records.bestGoalDiff).toMatchObject({
      player: { name: "Ana" },
      edition: { number: 1 },
      gd: 7,
    });
  });

  it("vitórias seguidas e jejum (empate não conta como vitória)", () => {
    expect(records.winStreak).toMatchObject({
      player: { name: "Ana" },
      count: 2,
    });
    expect(records.drought).toMatchObject({
      player: { name: "Beto" },
      count: 4,
      from: { number: 1 },
      to: { number: 2 },
    });
  });

  it("finais seguidas; títulos seguidos só com o mesmo campeão", () => {
    expect(records.finalsStreak).toMatchObject({
      player: { name: "Ana" },
      count: 2,
    });
    expect(records.titleStreak).toBeNull();
  });

  it("títulos seguidos: Ana campeã nas duas edições", () => {
    const swapped = entries.map((x) =>
      x.id === 201
        ? { ...x, result: "campeao" }
        : x.id === 202
          ? { ...x, result: "vice" }
          : x,
    ) as Entry[];
    const r = computeRecords({ ...data, entries: swapped });
    expect(r.titleStreak).toMatchObject({
      player: { name: "Ana" },
      count: 2,
      from: { number: 1 },
      to: { number: 2 },
    });
  });

  it("clássico mais jogado, com quem venceu mais primeiro", () => {
    expect(records.classic).toMatchObject({
      a: { name: "Ana" },
      b: { name: "Beto" },
      aWins: 2,
      bWins: 0,
      draws: 2,
    });
  });
});

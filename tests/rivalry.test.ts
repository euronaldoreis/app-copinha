import { describe, expect, it } from "vitest";
import type { Edition, Entry, Match, Player, Team } from "@/db/schema";
import { computeRivalry, type AllData } from "@/lib/stats";

// Dados montados à mão: duas edições entre Ana (1) e Beto (2), com Caio (3)
// de figurante para garantir que jogos com outros não entram.
const player = (id: number, name: string) => ({ id, name }) as Player;
const team = (id: number, name: string) => ({ id, name }) as Team;
const edition = (id: number, number: number, format = "grupos") =>
  ({ id, number, name: `Copinha ${number}`, format, playedOn: `2026-0${number}-01`, status: "encerrada" }) as Edition;
const entry = (id: number, editionId: number, playerId: number, teamId: number | null) =>
  ({ id, editionId, playerId, teamId }) as Entry;
let nextId = 1;
const match = (
  editionId: number,
  stage: string,
  round: number,
  home: number,
  away: number,
  score: [number, number],
  pens: [number, number] | null = null,
  groupLabel: string | null = null,
) =>
  ({
    id: nextId++,
    editionId,
    stage,
    round,
    slot: 0,
    groupLabel,
    homeEntryId: home,
    awayEntryId: away,
    homeScore: score[0],
    awayScore: score[1],
    homePens: pens?.[0] ?? null,
    awayPens: pens?.[1] ?? null,
  }) as Match;

function sample(): AllData {
  return {
    players: [player(1, "Ana"), player(2, "Beto"), player(3, "Caio")],
    teams: [team(10, "Flamengo"), team(20, "Palmeiras"), team(30, "Bahia")],
    editions: [edition(1, 1), edition(2, 2)],
    entries: [
      entry(101, 1, 1, 10),
      entry(102, 1, 2, 20),
      entry(103, 1, 3, 30),
      entry(201, 2, 1, 20),
      entry(202, 2, 2, 10),
      entry(203, 2, 3, null),
    ],
    matches: [
      // Copinha 1: grupo (Ana 3x0) e final (Beto vence nos pênaltis)
      match(1, "grupo", 1, 101, 102, [3, 0], null, "A"),
      match(1, "grupo", 2, 101, 103, [5, 0], null, "A"), // contra o Caio: fora
      match(1, "mata", 1, 102, 101, [1, 1], [4, 3]),
      // Copinha 2: grupo empatado, semifinal do Beto (2x1); final vazia
      match(2, "grupo", 1, 202, 201, [2, 2], null, "A"),
      match(2, "mata", 1, 202, 201, [2, 1]),
      match(2, "mata", 2, 202, 203, [0, 0]),
      { ...match(2, "mata", 1, 201, 202, [0, 0]), homeScore: null, awayScore: null }, // não jogado
    ],
  };
}

describe("confronto direto", () => {
  it("soma o retrospecto do lado de quem foi escolhido primeiro", () => {
    const r = computeRivalry(sample(), 1, 2);
    expect(r.record).toEqual({ played: 4, wins: 1, draws: 2, losses: 1, gf: 7, ga: 5 });
    // do outro lado, tudo invertido
    const inv = computeRivalry(sample(), 2, 1);
    expect(inv.record).toMatchObject({ wins: 1, losses: 1, gf: 5, ga: 7 });
  });

  it("lista do jogo mais recente para o mais antigo, com fase e times", () => {
    const { games } = computeRivalry(sample(), 1, 2);
    expect(games.map((g) => `${g.edition.number} ${g.label} ${g.aScore}-${g.bScore}`)).toEqual([
      "2 Semifinal 1-2",
      "2 Grupo A 2-2",
      "1 Final 1-1",
      "1 Grupo A 3-0",
    ]);
    expect(games[0]).toMatchObject({ aTeam: "Palmeiras", bTeam: "Flamengo", winner: "b" });
    // empate no mata-mata: os pênaltis dizem quem passou
    expect(games[2]).toMatchObject({ aPens: 3, bPens: 4, winner: "b", final: true });
    expect(games[1].winner).toBeNull();
  });

  it("acha a maior vitória, quem passou no mata-mata e a sequência atual", () => {
    const r = computeRivalry(sample(), 1, 2);
    expect(r.biggest.a?.aScore).toBe(3);
    expect(r.biggest.b?.label).toBe("Semifinal");
    expect(r.knockouts).toEqual({ a: 0, b: 2 });
    expect(r.finals).toEqual({ a: 0, b: 1 });
    expect(r.streak).toEqual({ who: "b", count: 1 });
  });

  it("sem jogos entre os dois, volta tudo zerado", () => {
    const r = computeRivalry(sample(), 1, 99);
    expect(r.games).toHaveLength(0);
    expect(r.streak).toBeNull();
    expect(r.biggest).toEqual({ a: null, b: null });
  });
});

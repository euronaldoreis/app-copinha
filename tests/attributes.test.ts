import { describe, expect, it } from "vitest";
import { computeAttributes } from "@/lib/attributes";
import type { PlayerStats } from "@/lib/stats";

const base = {
  player: { id: 1, name: "A" },
  participations: 4,
  titles: 1,
  vices: 0,
  finals: 2,
  thirds: 0,
  podiums: 2,
  top4: 3,
  gd: 0,
  pct: 50,
  points: 0,
  bestResult: null,
  played: 10,
  wins: 4,
  draws: 2,
  losses: 4,
  gf: 20,
  ga: 10,
} as unknown as PlayerStats;

describe("atributos do jogador", () => {
  it("calcula cada eixo de 0 a 100", () => {
    expect(computeAttributes(base, 20)).toEqual({
      atq: 50, // 2 gols por jogo, teto de 4
      vit: 50,
      pod: 50,
      def: 75, // 1 gol sofrido por jogo
      tit: 25,
      exp: 50, // 10 dos 20 jogos do veterano
    });
  });

  it("não passa dos limites", () => {
    const extremo = { ...base, gf: 100, ga: 100 } as PlayerStats;
    const v = computeAttributes(extremo, 5)!;
    expect(v.atq).toBe(100);
    expect(v.def).toBe(0);
    expect(v.exp).toBe(100);
  });

  it("sem jogos não há atributos", () => {
    expect(computeAttributes({ ...base, played: 0 } as PlayerStats, 20)).toBeNull();
  });
});

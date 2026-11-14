import { describe, expect, it } from "vitest";
import { sortByGames } from "@/lib/stats";

const row = (
  name: string,
  wins: number,
  draws: number,
  losses: number,
  gf = 0,
  ga = 0,
) => {
  const played = wins + draws + losses;
  const points = wins * 3 + draws;
  return {
    player: { name },
    played,
    points,
    pct: played ? Math.round((points / (played * 3)) * 100) : null,
    gf,
    gd: gf - ga,
  };
};

describe("ranking de jogos", () => {
  it("quem jogou mais não fica atrás de quem tem pouco jogo e % maior", () => {
    const rows = [
      row("Estreante", 1, 0, 0), // 100% em 1 jogo
      row("Veterano", 7, 0, 3), // 70% em 10 jogos
      row("Mediano", 3, 1, 2), // 3V 1E 2D
    ];
    const sorted = sortByGames(rows).map((r) => r.player.name);
    expect(sorted).toEqual(["Veterano", "Mediano", "Estreante"]);
  });

  it("empate em pontos: melhor aproveitamento vem primeiro", () => {
    const rows = [
      row("Muitos jogos", 2, 0, 4), // 6 pts em 6 jogos = 33%
      row("Poucos jogos", 2, 0, 0), // 6 pts em 2 jogos = 100%
    ];
    expect(sortByGames(rows).map((r) => r.player.name)).toEqual([
      "Poucos jogos",
      "Muitos jogos",
    ]);
  });

  it("desempata por saldo, gols marcados, jogos e nome", () => {
    const sorted = sortByGames([
      row("Beto", 2, 0, 0, 4, 2),
      row("Ana", 2, 0, 0, 5, 3), // mesmo saldo, mais gols
      row("Caio", 2, 0, 0, 6, 0), // melhor saldo
      row("Abel", 2, 0, 0, 5, 3), // igual à Ana: nome decide
    ]).map((r) => r.player.name);
    expect(sorted).toEqual(["Caio", "Abel", "Ana", "Beto"]);
  });

  it("não altera a lista original", () => {
    const rows = [row("B", 0, 0, 1), row("A", 1, 0, 0)];
    sortByGames(rows);
    expect(rows[0].player.name).toBe("B");
  });
});

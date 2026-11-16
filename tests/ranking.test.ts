import { describe, expect, it } from "vitest";
import { RANK_FILTERS, eligible, rankFilter, sortByFilter } from "@/lib/ranking";

const row = (
  name: string,
  o: Partial<{
    titles: number;
    finals: number;
    podiums: number;
    top4: number;
    participations: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
  }> = {},
) => {
  const wins = o.wins ?? 0;
  const draws = o.draws ?? 0;
  const losses = o.losses ?? 0;
  const played = wins + draws + losses;
  const points = wins * 3 + draws;
  const gf = o.gf ?? 0;
  return {
    player: { name },
    titles: o.titles ?? 0,
    finals: o.finals ?? 0,
    podiums: o.podiums ?? 0,
    top4: o.top4 ?? 0,
    participations: o.participations ?? 1,
    wins,
    gf,
    gd: gf - (o.ga ?? 0),
    played,
    points,
    pct: played ? Math.round((points / (played * 3)) * 100) : null,
  };
};

const names = (rows: { player: { name: string } }[]) => rows.map((r) => r.player.name);

describe("filtros do ranking", () => {
  const rows = [
    row("Ana", { titles: 2, finals: 2, participations: 4, wins: 8, gf: 20, ga: 10, losses: 4 }),
    row("Beto", { titles: 1, finals: 3, participations: 9, wins: 12, draws: 2, gf: 18, ga: 14, losses: 6 }),
    row("Caio", { titles: 0, finals: 0, participations: 12, wins: 5, gf: 30, ga: 25, losses: 15 }),
    row("Duda", { titles: 1, finals: 1, participations: 2, wins: 3, gf: 9, ga: 3 }),
  ];

  it("cada filtro ordena pelo seu critério", () => {
    expect(names(sortByFilter("titulos", rows))).toEqual(["Ana", "Beto", "Duda", "Caio"]);
    expect(names(sortByFilter("finais", rows))).toEqual(["Beto", "Ana", "Duda", "Caio"]);
    expect(names(sortByFilter("participacoes", rows))).toEqual(["Caio", "Beto", "Ana", "Duda"]);
    expect(names(sortByFilter("vitorias", rows))).toEqual(["Beto", "Ana", "Caio", "Duda"]);
    expect(names(sortByFilter("gols", rows))).toEqual(["Caio", "Ana", "Beto", "Duda"]);
  });

  it("pontuação geral soma 3 por vitória e 1 por empate", () => {
    // Beto: 12V 2E = 38 pts; Ana: 8V = 24; Caio: 5V = 15; Duda: 3V = 9
    expect(names(sortByFilter("pontos", rows))).toEqual(["Beto", "Ana", "Caio", "Duda"]);
    const pontos = rankFilter("pontos")!;
    expect(pontos.value(rows[1] as never)).toBe(38);
  });

  it("empate no critério: desempata e, por fim, pelo nome", () => {
    const tied = [row("Zeca", { wins: 3, gf: 6 }), row("Abel", { wins: 3, gf: 6 })];
    expect(names(sortByFilter("vitorias", tied))).toEqual(["Abel", "Zeca"]);
    expect(names(sortByFilter("gols", tied))).toEqual(["Abel", "Zeca"]);
  });

  it("filtros de jogos deixam de fora quem nunca jogou", () => {
    const list = [row("Joga", { wins: 1 }), row("Só registro", { titles: 1 })];
    expect(names(eligible(rankFilter("vitorias")!, list))).toEqual(["Joga"]);
    expect(names(eligible(rankFilter("titulos")!, list))).toEqual(["Joga", "Só registro"]);
  });

  it("descreve o valor com o plural certo", () => {
    expect(rankFilter("titulos")!.describe(1)).toBe("1 título");
    expect(rankFilter("titulos")!.describe(3)).toBe("3 títulos");
    expect(rankFilter("finais")!.describe(2)).toBe("2 finais");
    expect(rankFilter("gols")!.describe(1)).toBe("1 gol");
    expect(RANK_FILTERS.map((f) => f.id)).toHaveLength(6);
    expect(rankFilter("nada")).toBeUndefined();
  });

  it("não altera a lista original", () => {
    const copy = [...rows];
    sortByFilter("gols", rows);
    expect(names(rows)).toEqual(names(copy));
  });
});

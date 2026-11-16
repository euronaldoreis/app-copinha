// Filtros do ranking de jogadores: o que cada um mede e como ordena.
import { plural } from "./labels";
import { sortByGames, type PlayerStats } from "./stats";

export type RankFilter =
  | "titulos"
  | "finais"
  | "participacoes"
  | "vitorias"
  | "gols"
  | "pontos";

export interface RankFilterDef {
  id: RankFilter;
  /** Texto do botão de filtro. */
  label: string;
  /** Valor que o filtro mede. */
  value: (r: PlayerStats) => number;
  /** Valor por extenso, como no pódio: "3 títulos". */
  describe: (n: number) => string;
  /** Mede jogos disputados: quem nunca jogou fica de fora. */
  needsGames: boolean;
}

export const RANK_FILTERS: RankFilterDef[] = [
  {
    id: "titulos",
    label: "Mais títulos",
    value: (r) => r.titles,
    describe: (n) => plural(n, "título", "títulos"),
    needsGames: false,
  },
  {
    id: "finais",
    label: "Mais finais",
    value: (r) => r.finals,
    describe: (n) => plural(n, "final", "finais"),
    needsGames: false,
  },
  {
    id: "participacoes",
    label: "Mais participações",
    value: (r) => r.participations,
    describe: (n) => plural(n, "participação", "participações"),
    needsGames: false,
  },
  {
    id: "vitorias",
    label: "Mais vitórias",
    value: (r) => r.wins,
    describe: (n) => plural(n, "vitória", "vitórias"),
    needsGames: true,
  },
  {
    id: "gols",
    label: "Mais gols",
    value: (r) => r.gf,
    describe: (n) => plural(n, "gol", "gols"),
    needsGames: true,
  },
  {
    id: "pontos",
    label: "Pontuação geral",
    value: (r) => r.points,
    describe: (n) => plural(n, "ponto", "pontos"),
    needsGames: true,
  },
];

export function rankFilter(id: string | undefined): RankFilterDef | undefined {
  return RANK_FILTERS.find((f) => f.id === id);
}

type Row = { player: { name: string } } & Pick<
  PlayerStats,
  | "titles"
  | "finals"
  | "podiums"
  | "top4"
  | "participations"
  | "wins"
  | "gf"
  | "gd"
  | "pct"
  | "points"
  | "played"
>;

const byName = (a: Row, b: Row) =>
  a.player.name.localeCompare(b.player.name, "pt-BR");

/**
 * Ordena para o filtro escolhido. O critério do filtro vem primeiro; os
 * desempates seguem do mais para o menos importante e, no fim, o nome.
 */
export function sortByFilter<T extends Row>(filter: RankFilter, rows: T[]): T[] {
  const list = [...rows];
  const pct = (r: Row) => r.pct ?? 0;
  switch (filter) {
    case "titulos":
      return list.sort(
        (a, b) =>
          b.titles - a.titles ||
          b.finals - a.finals ||
          b.podiums - a.podiums ||
          b.top4 - a.top4 ||
          b.participations - a.participations ||
          pct(b) - pct(a) ||
          byName(a, b),
      );
    case "finais":
      return list.sort(
        (a, b) =>
          b.finals - a.finals ||
          b.titles - a.titles ||
          b.podiums - a.podiums ||
          b.top4 - a.top4 ||
          b.participations - a.participations ||
          byName(a, b),
      );
    case "participacoes":
      return list.sort(
        (a, b) =>
          b.participations - a.participations ||
          b.titles - a.titles ||
          b.finals - a.finals ||
          b.podiums - a.podiums ||
          byName(a, b),
      );
    case "vitorias":
      return list.sort(
        (a, b) =>
          b.wins - a.wins ||
          pct(b) - pct(a) ||
          b.gd - a.gd ||
          b.gf - a.gf ||
          byName(a, b),
      );
    case "gols":
      return list.sort(
        (a, b) =>
          b.gf - a.gf || b.gd - a.gd || b.wins - a.wins || pct(b) - pct(a) || byName(a, b),
      );
    case "pontos":
      return sortByGames(list);
  }
}

/** Quem entra no ranking de um filtro: sem jogos não há vitória, gol nem ponto. */
export function eligible<T extends Pick<PlayerStats, "played">>(
  def: RankFilterDef,
  rows: T[],
): T[] {
  return def.needsGames ? rows.filter((r) => r.played > 0) : rows;
}

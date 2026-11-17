// Atributos do jogador (de 0 a 100) calculados a partir do histórico, para o
// gráfico em hexágono do perfil. Nada é digitado: tudo sai dos jogos.
import type { PlayerStats } from "./stats";

export const ATTRIBUTES = [
  { key: "atq", label: "ATQ", name: "Ataque", short: "ataque", hint: "gols marcados por jogo" },
  { key: "vit", label: "VIT", name: "Vitórias", short: "vitórias", hint: "aproveitamento dos pontos" },
  { key: "pod", label: "PÓD", name: "Pódio", short: "pódios", hint: "edições terminadas no pódio" },
  { key: "def", label: "DEF", name: "Defesa", short: "defesa", hint: "poucos gols sofridos por jogo" },
  { key: "tit", label: "TÍT", name: "Títulos", short: "títulos", hint: "edições que terminou campeão" },
  { key: "exp", label: "EXP", name: "Experiência", short: "rodagem", hint: "jogos disputados, comparado ao veterano" },
] as const;

export type AttributeKey = (typeof ATTRIBUTES)[number]["key"];

/** Média de gols por jogo que vale 100 (ataque) ou 0 (defesa). */
const GOALS_CAP = 4;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * `maxPlayed` é o número de jogos do jogador que mais jogou: a experiência é
 * relativa ao grupo. Sem jogos, o jogador não tem atributos (null).
 */
export function computeAttributes(
  stats: PlayerStats,
  maxPlayed: number,
): Record<AttributeKey, number> | null {
  if (stats.played === 0) return null;
  const perGame = (n: number) => n / stats.played;
  const parts = stats.participations || 1;
  return {
    atq: clamp((perGame(stats.gf) / GOALS_CAP) * 100),
    vit: clamp(stats.pct ?? 0),
    pod: clamp((stats.podiums / parts) * 100),
    def: clamp(100 - (perGame(stats.ga) / GOALS_CAP) * 100),
    tit: clamp((stats.titles / parts) * 100),
    exp: clamp(maxPlayed > 0 ? (stats.played / maxPlayed) * 100 : 0),
  };
}

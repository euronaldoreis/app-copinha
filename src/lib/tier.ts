// Categoria de uma carta de jogador, pela melhor campanha dele. Define a
// moldura (ver .tier-* em globals.css).
export type Tier = "campeao" | "vice" | "podio" | "participou";

export const TIER_LABELS: Record<Tier, string> = {
  campeao: "Campeão",
  vice: "Vice",
  podio: "Pódio",
  participou: "Participou",
};

export function tierOf(bestResult: string | null): Tier {
  if (bestResult === "campeao") return "campeao";
  if (bestResult === "vice") return "vice";
  if (bestResult === "terceiro") return "podio";
  return "participou";
}

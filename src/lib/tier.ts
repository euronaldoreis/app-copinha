// Categoria de uma carta de jogador, pela melhor campanha e pelos títulos.
// Define a moldura (ver .tier-* em globals.css).
export type Tier =
  | "rubi"
  | "esmeralda"
  | "campeao"
  | "vice"
  | "podio"
  | "participou";

/** Títulos para a carta virar rubi (super campeão). */
export const SUPER_TITLES = 10;
/** Títulos para a carta de campeão virar esmeralda. */
export const EMERALD_TITLES = 5;

export const TIER_LABELS: Record<Tier, string> = {
  rubi: "Super campeão",
  esmeralda: "Campeão",
  campeao: "Campeão",
  vice: "Vice",
  podio: "Pódio",
  participou: "Participou",
};

export function tierOf(bestResult: string | null, titles = 0): Tier {
  if (titles >= SUPER_TITLES) return "rubi";
  if (titles >= EMERALD_TITLES) return "esmeralda";
  if (bestResult === "campeao") return "campeao";
  if (bestResult === "vice") return "vice";
  if (bestResult === "terceiro") return "podio";
  return "participou";
}

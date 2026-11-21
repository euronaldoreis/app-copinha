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

/** Nome da categoria no verso da carta: "Jogador" + `name`. */
const BACK_NAMES: Record<Tier, string> = {
  rubi: "Rubi",
  esmeralda: "Esmeralda",
  campeao: "Ouro",
  vice: "Prata",
  podio: "Bronze",
  participou: "Lixo",
};

export type CardHighlight = {
  /** Ex.: "Jogador Esmeralda". */
  title: string;
  /** Só a parte de destaque do título (ex.: "Esmeralda"). */
  name: string;
  count: number;
  /** Ex.: "copinhas ganhas". */
  text: string;
};

/** O destaque do verso da carta: a categoria e o número que mais pesa nela. */
export function cardHighlight(
  tier: Tier,
  s: { titles: number; finals: number; podiums: number; participations: number },
): CardHighlight {
  const name = s.participations ? BACK_NAMES[tier] : "Estreante";
  const pick = (count: number, one: string, many: string) => ({
    title: `Jogador ${name}`,
    name,
    count,
    text: count === 1 ? one : many,
  });
  if (s.titles > 0) return pick(s.titles, "copinha ganha", "copinhas ganhas");
  if (tier === "vice") return pick(s.finals, "final disputada", "finais disputadas");
  if (tier === "podio") return pick(s.podiums, "pódio", "pódios");
  return pick(s.participations, "copinha disputada", "copinhas disputadas");
}

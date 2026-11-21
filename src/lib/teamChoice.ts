// Escolha dos times de uma edição: cada jogador cita times, depois cada um
// bane um dos citados. Sobra exatamente um time por jogador para o sorteio.

export const PICKS_PER_PLAYER = 2;
export const BANS_PER_PLAYER = 1;

export type ChoiceKind = "escolha" | "veto";
export type ChoicePhase = "escolha" | "banimento" | "concluida";

export interface ChoiceRow {
  id: number;
  playerId: number;
  kind: string;
  team: string;
}

/** Sem acento e em minúsculas: "Ibis" e "Íbis" são o mesmo time. */
export const foldTeam = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export const PHASE_LABELS: Record<ChoicePhase, string> = {
  escolha: "Escolha dos times",
  banimento: "Banimento",
  concluida: "Times definidos",
};

export interface ChoiceState {
  phase: ChoicePhase;
  /** Escolhas dos participantes atuais, na ordem em que foram feitas. */
  picks: ChoiceRow[];
  bans: ChoiceRow[];
  picksTotal: number;
  bansTotal: number;
  /** Times citados e não banidos, na ordem em que foram citados. */
  remaining: string[];
  /** Quem baniu cada time (pelo nome normalizado). */
  bannedBy: Map<string, number>;
}

/**
 * Em que fase está a escolha, a partir dos participantes e do que já foi
 * lançado. Escolhas de quem saiu da edição não contam.
 */
export function choiceState(playerIds: number[], rows: ChoiceRow[]): ChoiceState {
  const inEdition = new Set(playerIds);
  const mine = rows
    .filter((r) => inEdition.has(r.playerId))
    .sort((a, b) => a.id - b.id);
  const picks = mine.filter((r) => r.kind === "escolha");
  const bans = mine.filter((r) => r.kind === "veto");
  const picksTotal = playerIds.length * PICKS_PER_PLAYER;
  const bansTotal = playerIds.length * BANS_PER_PLAYER;
  const bannedBy = new Map(bans.map((b) => [foldTeam(b.team), b.playerId]));
  const phase: ChoicePhase =
    playerIds.length === 0 || picks.length < picksTotal
      ? "escolha"
      : bans.length < bansTotal
        ? "banimento"
        : "concluida";
  return {
    phase,
    picks,
    bans,
    picksTotal,
    bansTotal,
    remaining: picks
      .filter((p) => !bannedBy.has(foldTeam(p.team)))
      .map((p) => p.team),
    bannedBy,
  };
}

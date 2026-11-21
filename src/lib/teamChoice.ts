// Escolha dos times de uma edição: cada jogador cita times, depois cada um
// bane um dos citados. Sobra exatamente um time por jogador, e aí os times
// são sorteados entre os jogadores, um por vez.

export const PICKS_PER_PLAYER = 2;
export const BANS_PER_PLAYER = 1;

/** escolha = time citado; veto = time banido; sorteio = time sorteado para o jogador. */
export type ChoiceKind = "escolha" | "veto" | "sorteio";
export type ChoicePhase = "escolha" | "banimento" | "sorteio" | "concluida";

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

/**
 * Ordem de quem escolhe e bane: a colocação na edição anterior (`previous`,
 * do campeão para baixo). Quem não jogou a anterior ou é estreante vai por
 * último, na ordem de inscrição.
 */
export function turnOrder(
  participants: { playerId: number; seed: number }[],
  previous: number[],
): number[] {
  const place = new Map(previous.map((id, i) => [id, i]));
  return [...participants]
    .sort(
      (a, b) =>
        (place.get(a.playerId) ?? Infinity) - (place.get(b.playerId) ?? Infinity) ||
        a.seed - b.seed,
    )
    .map((p) => p.playerId);
}

export interface ChoiceState {
  phase: ChoicePhase;
  /**
   * De quem é a vez (na escolha e no banimento): o primeiro da ordem que ainda
   * não terminou. Na escolha, cada um cita os seus times seguidos.
   */
  turn: number | null;
  /** Escolhas dos participantes atuais, na ordem em que foram feitas. */
  picks: ChoiceRow[];
  bans: ChoiceRow[];
  /** Times já sorteados, na ordem do sorteio. */
  draws: ChoiceRow[];
  picksTotal: number;
  bansTotal: number;
  /** Times citados e não banidos, na ordem em que foram citados. */
  remaining: string[];
  /** Dos que sobraram, os que ainda não saíram no sorteio. */
  undrawn: string[];
  /** Quem baniu cada time (pelo nome normalizado). */
  bannedBy: Map<string, number>;
}

/**
 * Em que fase está a escolha, a partir dos participantes (`playerIds`, já na
 * ordem de jogada, ver turnOrder) e do que já foi lançado. Escolhas de quem
 * saiu da edição não contam.
 */
export function choiceState(playerIds: number[], rows: ChoiceRow[]): ChoiceState {
  const inEdition = new Set(playerIds);
  const mine = rows
    .filter((r) => inEdition.has(r.playerId))
    .sort((a, b) => a.id - b.id);
  const picks = mine.filter((r) => r.kind === "escolha");
  const bans = mine.filter((r) => r.kind === "veto");
  const draws = mine.filter((r) => r.kind === "sorteio");
  const picksTotal = playerIds.length * PICKS_PER_PLAYER;
  const bansTotal = playerIds.length * BANS_PER_PLAYER;
  const bannedBy = new Map(bans.map((b) => [foldTeam(b.team), b.playerId]));
  const remaining = picks
    .filter((p) => !bannedBy.has(foldTeam(p.team)))
    .map((p) => p.team);
  const drawn = new Set(draws.map((d) => foldTeam(d.team)));
  const phase: ChoicePhase =
    playerIds.length === 0 || picks.length < picksTotal
      ? "escolha"
      : bans.length < bansTotal
        ? "banimento"
        : draws.length < playerIds.length
          ? "sorteio"
          : "concluida";
  const count = (list: ChoiceRow[], id: number) =>
    list.filter((r) => r.playerId === id).length;
  const turn =
    phase === "escolha"
      ? (playerIds.find((id) => count(picks, id) < PICKS_PER_PLAYER) ?? null)
      : phase === "banimento"
        ? (playerIds.find((id) => count(bans, id) < BANS_PER_PLAYER) ?? null)
        : null;
  return {
    phase,
    turn,
    picks,
    bans,
    draws,
    picksTotal,
    bansTotal,
    remaining,
    undrawn: remaining.filter((t) => !drawn.has(foldTeam(t))),
    bannedBy,
  };
}

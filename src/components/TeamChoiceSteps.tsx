import type { ChoiceState } from "@/lib/teamChoice";

const STEPS = [
  { phase: "escolha", label: "Escolha" },
  { phase: "banimento", label: "Banimento" },
  { phase: "sorteio", label: "Sorteio" },
] as const;

/** As três fases da escolha dos times, com o andamento da fase atual. */
export function ChoiceSteps({
  state,
  tv = false,
  shownDraws,
}: {
  state: ChoiceState;
  tv?: boolean;
  /** Na TV: sorteios já revelados (os outros ainda estão na animação). */
  shownDraws?: number;
}) {
  const drawn = shownDraws ?? state.draws.length;
  const players = state.bansTotal;
  const [done, total] =
    state.phase === "escolha"
      ? [state.picks.length, state.picksTotal]
      : state.phase === "banimento"
        ? [state.bans.length, state.bansTotal]
        : [drawn, players];
  const caption =
    state.phase === "escolha"
      ? `${done} de ${total} times citados`
      : state.phase === "banimento"
        ? `${done} de ${total} banimentos`
        : done === total
          ? "Todos os times sorteados"
          : `${done} de ${total} times sorteados`;
  // Com tudo sorteado (e revelado, na TV), as três fases ficam concluídas.
  const step =
    state.phase === "escolha"
      ? 0
      : state.phase === "banimento"
        ? 1
        : state.phase === "concluida" && done === total
          ? STEPS.length
          : 2;
  return (
    <div className={tv ? "choice-steps choice-steps-tv" : "choice-steps"}>
      <ol className="choice-steps-list">
        {STEPS.map((s, i) => (
          <li
            key={s.phase}
            className={i < step ? "is-done" : i === step ? "is-on" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="choice-step-dot">{i < step ? "✓" : i + 1}</span>
            <span className="choice-step-label">{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="choice-steps-progress">
        <span className="num">{caption}</span>
        <div
          className="progress"
          role="progressbar"
          aria-label={caption}
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total || 1}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
}

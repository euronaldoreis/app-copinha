import type { ChoiceState } from "@/lib/teamChoice";

const STEPS = [
  { phase: "escolha", label: "Escolha" },
  { phase: "banimento", label: "Banimento" },
  { phase: "concluida", label: "Times" },
] as const;

/** As três fases da escolha dos times, com o andamento da fase atual. */
export function ChoiceSteps({ state, tv = false }: { state: ChoiceState; tv?: boolean }) {
  const current = STEPS.findIndex((s) => s.phase === state.phase);
  const [done, total] =
    state.phase === "escolha"
      ? [state.picks.length, state.picksTotal]
      : state.phase === "banimento"
        ? [state.bans.length, state.bansTotal]
        : [state.remaining.length, state.remaining.length];
  const caption =
    state.phase === "escolha"
      ? `${done} de ${total} times citados`
      : state.phase === "banimento"
        ? `${done} de ${total} banimentos`
        : `${total} times para o sorteio`;
  return (
    <div className={tv ? "choice-steps choice-steps-tv" : "choice-steps"}>
      <ol className="choice-steps-list">
        {STEPS.map((s, i) => (
          <li
            key={s.phase}
            className={i < current ? "is-done" : i === current ? "is-on" : ""}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="choice-step-dot">{i < current ? "✓" : i + 1}</span>
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

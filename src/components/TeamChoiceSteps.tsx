import type { ChoiceState } from "@/lib/teamChoice";

const STEPS = [
  { key: "escolha", label: "Escolha" },
  { key: "banimento", label: "Banimento" },
  { key: "sorteio", label: "Sorteio" },
  { key: "grupos", label: "Grupos" },
] as const;

/** As fases da escolha dos times, com o andamento da fase atual. */
export function ChoiceSteps({
  state,
  tv = false,
  shownDraws,
  withGroups = false,
  groupsDone = false,
}: {
  state: ChoiceState;
  tv?: boolean;
  /** Na TV: sorteios já revelados (os outros ainda estão na animação). */
  shownDraws?: number;
  /** Edição com grupos: há a quarta fase, o sorteio dos grupos. */
  withGroups?: boolean;
  /** Os grupos já foram sorteados (e, na TV, mostrados). */
  groupsDone?: boolean;
}) {
  const steps = withGroups ? STEPS : STEPS.slice(0, 3);
  const drawn = shownDraws ?? state.draws.length;
  const players = state.bansTotal;
  const teamsDone = state.phase === "concluida" && drawn >= players;
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
        : !teamsDone
          ? `${done} de ${total} times sorteados`
          : !withGroups
            ? "Todos os times sorteados"
            : groupsDone
              ? "Grupos sorteados"
              : "Sorteio dos grupos";
  // Fase atual; com tudo pronto, todas ficam concluídas.
  const step =
    state.phase === "escolha"
      ? 0
      : state.phase === "banimento"
        ? 1
        : !teamsDone
          ? 2
          : !withGroups
            ? 3
            : groupsDone
              ? 4
              : 3;
  return (
    <div className={tv ? "choice-steps choice-steps-tv" : "choice-steps"}>
      <ol className="choice-steps-list" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li
            key={s.key}
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

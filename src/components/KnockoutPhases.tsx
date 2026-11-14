import { setKnockoutPhasesAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "./forms";

const OPTION_LABELS: Record<number, string> = {
  0: "Sem mata-mata (campeão por pontos)",
  2: "Só a final",
  4: "Semifinais e final",
  8: "Quartas, semifinais e final",
  16: "Oitavas, quartas, semifinais e final",
};

/**
 * Mudar quantas fases tem o mata-mata com a copa já em andamento (só admin).
 * A fase de grupos fica como está; o mata-mata é refeito.
 */
export function KnockoutPhases({
  editionId,
  format,
  qualifiers,
  thirdPlace,
  participants,
  groupsCount,
}: {
  editionId: number;
  format: string;
  qualifiers: number;
  thirdPlace: boolean;
  participants: number;
  groupsCount: number;
}) {
  // Só mostra o que cabe: não dá para classificar mais gente do que há, nem
  // menos do que o número de grupos.
  const options = [0, 2, 4, 8, 16].filter(
    (k) =>
      (k === 0 ? format === "liga" : k >= groupsCount) && k <= participants,
  );

  return (
    <ActionForm
      key={`${qualifiers}:${thirdPlace}`}
      action={setKnockoutPhasesAction}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="editionId" value={editionId} />
      <p className="text-body text-muted">
        Aumente (ou diminua) as fases do mata-mata mesmo com a copa em
        andamento. Os jogos e placares da fase de{" "}
        {format === "liga" ? "pontos corridos" : "grupos"} continuam como estão.
        O mata-mata é refeito com a classificação atual, e os placares dele são
        apagados.
      </p>
      <label>
        <span className="label">
          {format === "liga" ? "Decisão" : "Quantos avançam"}
        </span>
        <select name="qualifiers" className="field" defaultValue={qualifiers}>
          {options.map((k) => (
            <option key={k} value={k}>
              {k === 0 ? OPTION_LABELS[0] : `${k} · ${OPTION_LABELS[k]}`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2.5 text-body">
        <input
          type="checkbox"
          name="thirdPlace"
          defaultChecked={thirdPlace}
          className="size-4 accent-accent"
        />
        Disputa de 3º lugar
      </label>
      <div>
        <SubmitButton
          className="btn btn-danger"
          confirm="Refazer o mata-mata com essas fases? Os placares do mata-mata serão apagados; os jogos dos grupos continuam."
        >
          Salvar fases
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

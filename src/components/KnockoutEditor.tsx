import { setKnockoutAction } from "@/app/actions";
import type { Match } from "@/db/schema";
import { roundLabel } from "@/lib/labels";
import { isEditableSlot } from "@/lib/tournament";
import { ActionForm, SubmitButton } from "./forms";

interface EditorEntry {
  id: number;
  name: string;
  team: string | null;
}

/**
 * Escolher à mão quem joga cada confronto do mata-mata (só admin). Vagas que
 * dependem do resultado de outro jogo não aparecem para edição.
 */
export function KnockoutEditor({
  editionId,
  totalRounds,
  matches,
  entries,
}: {
  editionId: number;
  totalRounds: number;
  matches: Match[];
  entries: EditorEntry[];
}) {
  const sorted = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const editable = matches
    .filter(
      (m) => isEditableSlot(m.homeSource) || isEditableSlot(m.awaySource),
    )
    .sort((a, b) => a.round - b.round || a.slot - b.slot);

  if (editable.length === 0) {
    return (
      <p className="text-body text-muted">
        Todos os confrontos já dependem do resultado de outros jogos.
      </p>
    );
  }

  const select = (match: Match, side: "home" | "away") => {
    const source = side === "home" ? match.homeSource : match.awaySource;
    const current = side === "home" ? match.homeEntryId : match.awayEntryId;
    if (!isEditableSlot(source)) {
      return (
        <span className="field flex items-center text-faint">
          Vencedor de outro jogo
        </span>
      );
    }
    return (
      <select
        name={`slot_${match.id}_${side}`}
        defaultValue={current ?? ""}
        aria-label={`${side === "home" ? "Mandante" : "Visitante"} do confronto ${match.slot + 1}, ${roundLabel(match.round, totalRounds)}`}
        className="field"
      >
        <option value="">A definir</option>
        {sorted.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.team ? ` (${e.team})` : ""}
          </option>
        ))}
      </select>
    );
  };

  return (
    <ActionForm
      // recria o formulário quando os confrontos mudam no servidor
      key={editable.map((m) => `${m.id}${m.homeEntryId}${m.awayEntryId}`).join("|")}
      action={setKnockoutAction}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="editionId" value={editionId} />
      <p className="text-body text-muted">
        Escolha quem joga cada confronto. Quem mudar de confronto perde o placar
        e os jogos seguintes são refeitos. Vagas editadas deixam de seguir a
        classificação dos grupos. Para trocar dois participantes de lugar,
        mude os dois lados antes de salvar.
      </p>
      {editable.map((m) => (
        <div key={m.id} className="flex flex-col gap-2">
          <p className="text-body text-accent">
            {roundLabel(m.round, totalRounds)} · confronto {m.slot + 1}
            {m.homeScore != null && " · já jogado"}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {select(m, "home")}
            {select(m, "away")}
          </div>
        </div>
      ))}
      <div>
        <SubmitButton
          className="btn"
          confirm="Salvar os confrontos? Os placares dos jogos alterados (e dos seguintes) serão apagados."
        >
          Salvar confrontos
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

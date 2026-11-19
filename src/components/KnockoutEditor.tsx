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
      (m) =>
        isEditableSlot(m.homeSource, m.round, totalRounds) ||
        isEditableSlot(m.awaySource, m.round, totalRounds),
    )
    // Repescagem primeiro, depois o mata-mata por rodada.
    .sort(
      (a, b) =>
        Number(b.stage === "repescagem") - Number(a.stage === "repescagem") ||
        a.round - b.round ||
        a.slot - b.slot,
    );
  // Quem já tem vaga direta na 1ª fase do mata-mata não pode jogar a repescagem.
  const direct = new Set<number>();
  for (const m of matches.filter((x) => x.stage === "mata" && x.round === 1)) {
    if (m.homeEntryId != null && !m.homeSource?.startsWith("P:"))
      direct.add(m.homeEntryId);
    if (m.awayEntryId != null && !m.awaySource?.startsWith("P:"))
      direct.add(m.awayEntryId);
  }
  const phase = (m: Match) =>
    m.stage === "repescagem" ? "Repescagem" : roundLabel(m.round, totalRounds);

  if (editable.length === 0) {
    return (
      <p className="text-body text-muted">
        Os confrontos restantes dependem do resultado das semifinais.
      </p>
    );
  }

  const select = (match: Match, side: "home" | "away") => {
    const source = side === "home" ? match.homeSource : match.awaySource;
    const current = side === "home" ? match.homeEntryId : match.awayEntryId;
    if (!isEditableSlot(source, match.round, totalRounds)) {
      return (
        <span className="field flex items-center text-faint">
          {source?.startsWith("P:")
            ? `Vencedor da repescagem ${Number(source.split(":")[1]) + 1}`
            : "Decidido pelo jogo anterior"}
        </span>
      );
    }
    return (
      <select
        name={`slot_${match.id}_${side}`}
        defaultValue={current ?? ""}
        aria-label={`${side === "home" ? "Mandante" : "Visitante"} do confronto ${match.slot + 1}, ${phase(match)}`}
        className="field"
      >
        <option value="">A definir</option>
        {sorted.map((e) => {
          const blocked = match.stage === "repescagem" && direct.has(e.id);
          return (
            <option key={e.id} value={e.id} disabled={blocked}>
              {e.name}
              {e.team ? ` (${e.team})` : ""}
              {blocked ? " · já classificado" : ""}
            </option>
          );
        })}
      </select>
    );
  };

  return (
    <ActionForm
      // recria o formulário quando os confrontos mudam no servidor
      key={editable
        .map((m) => `${m.id}${m.homeEntryId}${m.awayEntryId}`)
        .join("|")}
      action={setKnockoutAction}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="editionId" value={editionId} />
      <p className="text-body text-muted">
        Escolha quem joga cada confronto. Quem mudar de confronto perde o placar
        e os jogos seguintes são refeitos. Vagas editadas deixam de seguir a
        classificação dos grupos e o vencedor do jogo anterior (inclusive nas
        semifinais). Para trocar dois participantes de lugar, mude os dois lados
        antes de salvar.
      </p>
      {editable.map((m) => (
        <div key={m.id} className="flex flex-col gap-2">
          <p className="text-body text-accent">
            {phase(m)} · {m.stage === "repescagem" ? "jogo" : "confronto"}{" "}
            {m.slot + 1}
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

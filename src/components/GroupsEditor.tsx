import { regenerateMatchesAction, setGroupsAction } from "@/app/actions";
import { GROUP_LABELS } from "@/lib/tournament";
import { ActionForm, SubmitButton } from "./forms";

interface EditorEntry {
  id: number;
  name: string;
  team: string | null;
  groupLabel: string | null;
}

/**
 * Montar os grupos à mão e gerar as rodadas de novo (só admin).
 * Antes de gerar a tabela, os grupos escolhidos valem para a geração; quem
 * ficar sem grupo só é aceito se ninguém tiver (aí o sorteio decide).
 * Depois de gerada, salvar refaz as rodadas e apaga os placares.
 */
export function GroupsEditor({
  editionId,
  groupsCount,
  started,
  entries,
}: {
  editionId: number;
  groupsCount: number;
  started: boolean;
  entries: EditorEntry[];
}) {
  const labels = GROUP_LABELS.slice(0, groupsCount);
  const sorted = [...entries].sort(
    (a, b) =>
      (a.groupLabel ?? "~").localeCompare(b.groupLabel ?? "~") ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const counts = labels.map((label) => ({
    label,
    n: entries.filter((e) => e.groupLabel === label).length,
  }));
  const unassigned = entries.filter((e) => e.groupLabel == null).length;

  return (
    <div className="flex flex-col gap-5">
      <ActionForm
        // recria o formulário quando os grupos mudam no servidor
        key={entries.map((e) => `${e.id}${e.groupLabel}`).join("|")}
        action={setGroupsAction}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="editionId" value={editionId} />
        <p className="text-body text-muted">
          {started
            ? "Mude os participantes de grupo. Ao salvar, as rodadas são refeitas e todos os placares são apagados."
            : "Escolha o grupo de cada participante. Deixe todos sem grupo para o sorteio decidir ao gerar a tabela."}
        </p>
        <p className="num text-body">
          {counts.map((c) => `Grupo ${c.label}: ${c.n}`).join(" · ")}
          {unassigned > 0 && ` · sem grupo: ${unassigned}`}
        </p>
        <div className="flex flex-col">
          {sorted.map((e) => (
            <label
              key={e.id}
              className="flex min-h-14 items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-name font-semibold">
                  {e.name}
                </span>
                {e.team && (
                  <span className="block truncate text-body text-muted">
                    {e.team}
                  </span>
                )}
              </span>
              <select
                name={`group_${e.id}`}
                defaultValue={e.groupLabel ?? ""}
                aria-label={`Grupo de ${e.name}`}
                className="field w-32 shrink-0"
              >
                {!started && <option value="">Sem grupo</option>}
                {labels.map((label) => (
                  <option key={label} value={label}>
                    Grupo {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div>
          <SubmitButton
            className="btn"
            confirm={
              started
                ? "Refazer as rodadas com esses grupos? Todos os placares desta edição serão apagados."
                : undefined
            }
          >
            Salvar grupos
          </SubmitButton>
        </div>
      </ActionForm>

      {started && (
        <ActionForm action={regenerateMatchesAction} className="flex flex-col gap-3">
          <input type="hidden" name="editionId" value={editionId} />
          <p className="text-body text-muted">
            Mantém os grupos e embaralha os confrontos de cada rodada. Os
            placares são apagados.
          </p>
          <div>
            <SubmitButton
              className="btn btn-danger"
              confirm="Gerar as rodadas de novo? Todos os placares desta edição serão apagados."
            >
              Gerar rodadas novamente
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

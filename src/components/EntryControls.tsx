"use client";

import { useState } from "react";
import { removeEntryAction, saveEntryAction } from "@/app/actions";
import { RESULT_LABELS, RESULT_ORDER } from "@/lib/labels";
import { ActionForm, SubmitButton } from "./forms";
import { CheckIcon, SaveIcon, TrashIcon } from "./icons";

/**
 * Controles de admin de um participante: time (e colocação, nas edições de
 * registro histórico), salvar e remover da edição.
 *
 * O botão de salvar aparece "selecionado" (amarelo, "Salvo") quando o time
 * mostrado no campo é o que já está gravado; ao mexer no campo ele volta a
 * ser "Salvar".
 */
export function EntryControls({
  entryId,
  playerName,
  team,
  result,
  manual,
  useTeams,
}: {
  entryId: number;
  playerName: string;
  /** Nome do time já gravado, ou null. */
  team: string | null;
  result: string | null;
  manual: boolean;
  /** Falso = edição só com os jogadores: sem campo de time. */
  useTeams: boolean;
}) {
  const [teamValue, setTeamValue] = useState(team ?? "");
  const [resultValue, setResultValue] = useState(result ?? "");

  const dirty =
    (useTeams && teamValue.trim() !== (team ?? "")) ||
    (manual && resultValue !== (result ?? ""));
  const saved = useTeams && team != null && !dirty;
  // Sem time e sem colocação para editar, só resta remover.
  const hasForm = useTeams || manual;

  return (
    // Começa na borda esquerda da foto e ocupa a largura toda no celular.
    <div className={`flex items-center gap-2 ${hasForm ? "pb-3 sm:pb-0" : ""}`}>
      {hasForm && (
      <ActionForm
        action={saveEntryAction}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none"
      >
        <input type="hidden" name="entryId" value={entryId} />
        {useTeams && (
          <input
            name="team"
            list="known-teams"
            value={teamValue}
            onChange={(e) => setTeamValue(e.target.value)}
            placeholder="Time"
            aria-label={`Time de ${playerName}`}
            className="field min-w-0 flex-1 sm:w-40 sm:flex-none"
          />
        )}
        {manual && (
          <select
            name="result"
            value={resultValue}
            onChange={(e) => setResultValue(e.target.value)}
            aria-label={`Colocação de ${playerName}`}
            className="field w-full sm:w-44"
          >
            <option value="">Só participou</option>
            {RESULT_ORDER.filter(
              (r) => r !== "participou" && r !== "eliminado",
            ).map((r) => (
              <option key={r} value={r}>
                {RESULT_LABELS[r]}
              </option>
            ))}
          </select>
        )}
        <SubmitButton
          className={saved ? "btn btn-icon btn-primary" : "btn btn-icon"}
          title={saved ? "Time salvo" : "Salvar"}
        >
          {saved ? <CheckIcon /> : <SaveIcon />}
          <span className="sr-only">{saved ? "Time salvo" : "Salvar"}</span>
        </SubmitButton>
      </ActionForm>
      )}
      {/* Formulário à parte: formulários não podem ficar um dentro do outro. */}
      <ActionForm action={removeEntryAction}>
        <input type="hidden" name="entryId" value={entryId} />
        <SubmitButton
          className="btn btn-icon btn-danger"
          title="Remover da edição"
          confirm={`Remover ${playerName} desta edição?`}
        >
          <TrashIcon />
          <span className="sr-only">Remover da edição</span>
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addLateEntryAction, type LateEntryState } from "@/app/actions";
import { SubmitButton } from "./forms";
import { TeamDrawReveal } from "./TeamDrawReveal";

/**
 * Incluir alguém com a edição em andamento. Nas edições com times, o padrão é
 * sortear entre os times que sobraram, com a roleta na tela.
 */
export function LateEntryForm({
  editionId,
  groups,
  liga,
  useTeams,
  freeTeams,
  players,
}: {
  editionId: number;
  /** Grupos e quantos participantes cada um tem (vazio na liga). */
  groups: { label: string; size: number }[];
  liga: boolean;
  useTeams: boolean;
  /** Times do sorteio que ninguém pegou. */
  freeTeams: string[];
  /** Jogadores cadastrados que ainda não estão na edição. */
  players: { id: number; name: string }[];
}) {
  const [state, action] = useActionState<LateEntryState, FormData>(
    addLateEntryAction,
    null,
  );
  const [mode, setMode] = useState<"sortear" | "escolher">(
    freeTeams.length ? "sortear" : "escolher",
  );
  // Roleta já vista (pelo `at` da inclusão), para não abrir de novo.
  const [closedAt, setClosedAt] = useState<number | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Cada inclusão limpa o formulário.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const reveal =
    state?.ok &&
    state.result?.drawnFrom &&
    state.result.team &&
    state.at !== closedAt
      ? state.result
      : null;

  // Sem times sobrando, só dá para escolher.
  const drawing = useTeams && mode === "sortear" && freeTeams.length > 0;
  const done = state?.ok && state.result;

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="editionId" value={editionId} />
        <p className="text-body text-muted">
          Os jogos e placares que já existem ficam como estão. O novo
          participante ganha só os jogos dele{" "}
          {liga ? "contra todos" : "contra os adversários do grupo"}, nas
          rodadas em que o adversário folga ou em rodadas novas no fim.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Jogador</span>
            <select name="playerId" className="field" defaultValue="">
              <option value="">Alguém novo (digite o nome)</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Nome de quem é novo</span>
            <input
              name="newName"
              className="field"
              maxLength={40}
              placeholder="Só se não estiver na lista"
            />
          </label>
          {groups.length > 0 && (
            <label>
              <span className="label">Grupo</span>
              <select name="groupLabel" className="field" defaultValue="">
                <option value="">O menor grupo</option>
                {groups.map((g) => (
                  <option key={g.label} value={g.label}>
                    Grupo {g.label} ({g.size} participantes)
                  </option>
                ))}
              </select>
            </label>
          )}
          {useTeams && (
            <fieldset className="flex flex-col gap-2">
              <legend className="label">Time</legend>
              {freeTeams.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <label className="chip cursor-pointer has-checked:bg-wash has-checked:font-semibold has-checked:text-ink">
                    <input
                      type="radio"
                      name="teamMode"
                      value="sortear"
                      checked={mode === "sortear"}
                      onChange={() => setMode("sortear")}
                      className="sr-only"
                    />
                    Sortear entre os que sobraram ({freeTeams.length})
                  </label>
                  <label className="chip cursor-pointer has-checked:bg-wash has-checked:font-semibold has-checked:text-ink">
                    <input
                      type="radio"
                      name="teamMode"
                      value="escolher"
                      checked={mode === "escolher"}
                      onChange={() => setMode("escolher")}
                      className="sr-only"
                    />
                    Escolher o time
                  </label>
                </div>
              )}
              {drawing ? (
                <p className="text-body text-muted">
                  Na urna: {freeTeams.join(", ")}.
                </p>
              ) : (
                <>
                  <input
                    name="team"
                    className="field"
                    list="late-entry-teams"
                    maxLength={60}
                    required
                    aria-label="Time do novo participante"
                    placeholder="Nome do time"
                  />
                  <datalist id="late-entry-teams">
                    {freeTeams.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </>
              )}
            </fieldset>
          )}
        </div>
        <div>
          <SubmitButton
            className="btn btn-primary"
            confirm={
              drawing
                ? "Incluir na edição, sortear o time e criar os jogos dele?"
                : "Incluir na edição e criar os jogos dele?"
            }
          >
            {drawing ? "Incluir e sortear o time" : "Incluir participante"}
          </SubmitButton>
        </div>
        {state?.error && (
          <p role="alert" className="text-body text-danger">
            {state.error}
          </p>
        )}
        {done && !reveal && (
          <p role="status" className="text-body text-muted">
            {done.player.name} entrou
            {done.groupLabel ? ` no Grupo ${done.groupLabel}` : ""}
            {done.team ? ` com ${done.team}` : ""}: {done.games}{" "}
            {done.games === 1 ? "jogo novo" : "jogos novos"}.
          </p>
        )}
      </form>

      {reveal &&
        createPortal(
          <div className="late-draw">
            <TeamDrawReveal
              key={state?.at}
              player={reveal.player}
              team={reveal.team!}
              candidates={reveal.drawnFrom!}
              number={1}
              total={1}
              countLabel="Sorteio do time"
              countdown
              onDone={() => setClosedAt(state?.at)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

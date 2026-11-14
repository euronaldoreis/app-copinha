"use client";

import { useState, useTransition } from "react";
import { drawTeamsAction } from "@/app/actions";
import { arcade } from "@/lib/labels";
import { useConfirm } from "./ConfirmDialog";
import type { DrawAssignment } from "@/lib/services";
import { ShuffleIcon } from "./icons";

/**
 * Sorteio dos times. O servidor sorteia e grava tudo de uma vez; a revelação,
 * um participante por vez, é só o espetáculo.
 */
export function DrawPanel({
  editionId,
  hasTeams,
}: {
  editionId: number;
  hasTeams: boolean;
}) {
  const [draw, setDraw] = useState<DrawAssignment[] | null>(null);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();

  const start = async () => {
    if (
      hasTeams &&
      !(await ask({
        message: "Sortear de novo? Os times atuais serão trocados.",
        confirmLabel: "Sortear de novo",
        danger: true,
      }))
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await drawTeamsAction(editionId);
      if (result.error || !result.draw) {
        setError(result.error ?? "Não foi possível sortear.");
        return;
      }
      setStep(0);
      setRevealed(false);
      setDraw(result.draw);
    });
  };

  const current = draw?.[step];
  const last = draw != null && step === draw.length - 1;

  return (
    <>
      {dialog}
      <button type="button" className="btn" onClick={start} disabled={pending}>
        <ShuffleIcon width={18} height={18} />
        {pending ? "Sorteando..." : hasTeams ? "Sortear de novo" : "Sortear times"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-body text-danger">
          {error}
        </p>
      )}

      {draw && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sorteio dos times"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-canvas px-6"
        >
          <p className="num text-body text-muted">
            {step + 1} de {draw.length}
          </p>
          <div className="flex min-h-40 flex-col items-center gap-4 text-center">
            <p className="text-title">{arcade(current.playerName)}</p>
            {revealed ? (
              <p
                key={current.entryId}
                className="animate-reveal text-title text-accent"
              >
                {arcade(current.teamName)}
              </p>
            ) : (
              <p className="blink font-pixel text-[10px] uppercase text-accent">
                vai jogar com...
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            {!revealed ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRevealed(true)}
                autoFocus
              >
                Revelar time
              </button>
            ) : last ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDraw(null)}
              >
                Concluir sorteio
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setStep(step + 1);
                  setRevealed(false);
                }}
              >
                Próximo
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setDraw(null)}
            >
              Pular e ver todos
            </button>
          </div>
        </div>
      )}
    </>
  );
}

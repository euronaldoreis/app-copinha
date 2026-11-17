"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { clearResultAction, saveResultAction } from "@/app/actions";
import { CheckIcon, SwordsIcon } from "./icons";
import { TeamBadge, type MatchSide } from "./TeamShield";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

function ScoreInput({
  label,
  value,
  onChange,
  small = false,
  disabled = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <input
      className={`score-input ${small ? "score-input-sm" : ""}`}
      inputMode="numeric"
      autoComplete="off"
      placeholder="—"
      aria-label={label}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(digits(e.target.value))}
      onFocus={(e) => e.target.select()}
    />
  );
}

function Player({ side }: { side: MatchSide }) {
  return (
    <div className="flex w-[72px] min-w-0 flex-col items-center gap-1 text-center">
      <TeamBadge side={side} size={38} />
      <span className="max-w-full truncate text-[11px] font-black uppercase tracking-wide">
        {side.name}
      </span>
    </div>
  );
}

/** Modal para lançar ou corrigir o placar de um jogo. */
export function ScoreDialog({
  matchId,
  knockout,
  home,
  away,
  initial,
  onClose,
}: {
  matchId: number;
  knockout: boolean;
  home: MatchSide;
  away: MatchSide;
  initial: {
    homeScore: number | null;
    awayScore: number | null;
    homePens: number | null;
    awayPens: number | null;
  };
  onClose: () => void;
}) {
  const str = (n: number | null) => n?.toString() ?? "";
  const [hs, setHs] = useState(str(initial.homeScore));
  const [as, setAs] = useState(str(initial.awayScore));
  const [hp, setHp] = useState(str(initial.homePens));
  const [ap, setAp] = useState(str(initial.awayPens));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const windowRef = useRef<HTMLDivElement>(null);
  const played = initial.homeScore != null && initial.awayScore != null;
  const tie = hs !== "" && hs === as;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && windowRef.current) {
        // O foco fica dentro do modal enquanto ele estiver aberto.
        const items = [
          ...windowRef.current.querySelectorAll<HTMLElement>(
            "input:not(:disabled), button:not(:disabled)",
          ),
        ];
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? items[(i - 1 + items.length) % items.length]
          : items[(i + 1) % items.length];
        e.preventDefault();
        next?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);

  const finish = (action: () => ReturnType<typeof saveResultAction>) =>
    startTransition(async () => {
      const state = await action();
      if (state?.error) setError(state.error);
      else onClose();
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    finish(() =>
      saveResultAction(matchId, {
        homeScore: hs,
        awayScore: as,
        // pênaltis só contam quando o jogo termina empatado
        homePens: knockout && tie ? hp : "",
        awayPens: knockout && tie ? ap : "",
      }),
    );
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={windowRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-title"
        className="score-window"
      >
        <button
          type="button"
          className="score-close"
          aria-label="Fechar"
          onClick={onClose}
          disabled={pending}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </button>

        <h2 id="score-title" className="flex items-center justify-center gap-3 text-title">
          <SwordsIcon width={34} height={34} className="text-[#dbe7ff] drop-shadow-[2px_2px_0_#0a1a52]" />
          Resultado
        </h2>
        <p className="mt-2 text-center text-[15px] font-bold text-accent">
          Quem saiu vencedor dessa batalha?
        </p>

        <form onSubmit={save} className="mt-5">
          <div className="flex items-center justify-between gap-1.5">
            <Player side={home} />
            <ScoreInput label={`Gols de ${home.name}`} value={hs} onChange={setHs} autoFocus />
            <span className="font-pixel text-[22px] text-accent" aria-hidden="true">×</span>
            <ScoreInput label={`Gols de ${away.name}`} value={as} onChange={setAs} />
            <Player side={away} />
          </div>

          {knockout && (
            <>
              <p className="mt-5 text-center text-[13px] font-bold text-muted">
                Se houver empate, informe também o placar dos pênaltis.
              </p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="w-[76px] text-right text-[12px] font-black uppercase tracking-wider">
                  Pênaltis
                </span>
                <ScoreInput
                  small
                  label={`Pênaltis de ${home.name}`}
                  value={tie ? hp : ""}
                  onChange={setHp}
                  disabled={!tie}
                />
                <span className="font-pixel text-[18px] text-accent" aria-hidden="true">×</span>
                <ScoreInput
                  small
                  label={`Pênaltis de ${away.name}`}
                  value={tie ? ap : ""}
                  onChange={setAp}
                  disabled={!tie}
                />
                <span className="w-[76px]" />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="mt-4 text-center text-body font-bold text-danger">
              {error}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              <CheckIcon width={20} height={20} strokeWidth={3} />
              Salvar
            </button>
          </div>
          {played && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-[13px] font-black uppercase tracking-wider text-danger underline-offset-4 hover:underline"
                disabled={pending}
                onClick={() => finish(() => clearResultAction(matchId))}
              >
                Apagar placar
              </button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

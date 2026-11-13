"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startEditionAction } from "@/app/actions";
import { arcade } from "@/lib/labels";
import type { GroupDrawItem } from "@/lib/services";

/** Tempo da roleta girando, do nome parado na tela e de cada troca de nome. */
const SPIN_MS = 1700;
const HOLD_MS = 1300;
const TICK_MS = 85;

/**
 * Animação do sorteio dos grupos: os nomes que ainda faltam giram numa roleta,
 * um é sorteado por vez e entra na lista do grupo dele.
 */
function GroupDrawOverlay({
  draw,
  closing,
  onClose,
}: {
  draw: GroupDrawItem[];
  closing: boolean;
  onClose: () => void;
}) {
  // `placed`: quantos já estão nos grupos. `landed`: o da vez já foi revelado.
  const [placed, setPlaced] = useState(0);
  const [landed, setLanded] = useState(false);
  const [tick, setTick] = useState(0);
  const done = placed >= draw.length;

  useEffect(() => {
    if (done) return;
    if (landed) {
      const next = setTimeout(() => {
        setPlaced((p) => p + 1);
        setLanded(false);
      }, HOLD_MS);
      return () => clearTimeout(next);
    }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Sem roleta para quem pediu menos movimento, e no último (não há suspense).
    const spin = calm || draw.length - placed === 1 ? 350 : SPIN_MS;
    const flicker = setInterval(() => setTick((t) => t + 1), TICK_MS);
    const land = setTimeout(() => setLanded(true), spin);
    return () => {
      clearInterval(flicker);
      clearTimeout(land);
    };
  }, [placed, landed, done, draw.length]);

  const labels = [...new Set(draw.map((d) => d.groupLabel ?? ""))].sort();
  const pool = draw.slice(placed);
  const current = draw[placed];
  // Na roleta os nomes pulam de 3 em 3 para não parecerem em ordem.
  const spinning = pool.length ? pool[(tick * 3 + 1) % pool.length] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sorteio dos grupos"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header>
          <h2 className="text-title">Sorteio dos grupos</h2>
          <p className="num mt-1.5 text-body text-muted">
            {done
              ? "Grupos definidos"
              : `Sorteando ${placed + 1} de ${draw.length}`}
          </p>
        </header>

        <div
          className="flex min-h-28 flex-col items-center justify-center gap-1 text-center"
          aria-live="polite"
        >
          {done ? (
            <p className="text-body text-muted">
              Todo mundo sorteado. A tabela de jogos já está pronta.
            </p>
          ) : landed && current ? (
            <>
              <p key={current.entryId} className="animate-reveal text-title">
                {arcade(current.playerName)}
              </p>
              <p className="animate-reveal text-name font-semibold text-accent">
                Grupo {current.groupLabel}
              </p>
            </>
          ) : (
            <>
              <p className="text-title text-faint" aria-hidden="true">
                {arcade(spinning?.playerName ?? "")}
              </p>
              <p className="blink font-pixel text-[10px] uppercase text-accent">
                Sorteando...
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {labels.map((label) => {
            const members = draw
              .slice(0, placed + (landed ? 1 : 0))
              .filter((d) => (d.groupLabel ?? "") === label);
            return (
              <div key={label} className="card min-h-32 px-4 py-4">
                <h3 className="mb-2 text-body text-muted">Grupo {label}</h3>
                {members.map((m) => (
                  <div key={m.entryId} className="animate-reveal py-1.5">
                    <p className="truncate text-name font-semibold">
                      {m.playerName}
                    </p>
                    {m.teamName && (
                      <p className="truncate text-body text-muted">{m.teamName}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pb-4">
          {done ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              disabled={closing}
              autoFocus
            >
              {closing ? "Abrindo..." : "Ver tabela de jogos"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setLanded(false);
                setPlaced(draw.length);
              }}
            >
              Pular animação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Botão que gera a tabela. Com grupos, mostra antes a animação do sorteio; a
 * página só é atualizada quando ela termina, para não entregar o resultado.
 */
export function StartPanel({
  editionId,
  hasGroups,
}: {
  editionId: number;
  hasGroups: boolean;
}) {
  const router = useRouter();
  const [draw, setDraw] = useState<GroupDrawItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () => {
    const question = hasGroups
      ? "Sortear os grupos e gerar a tabela de jogos?"
      : "Sortear os confrontos e gerar a tabela de jogos?";
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const result = await startEditionAction(editionId);
      if (result.error || !result.draw) {
        setError(result.error ?? "Não foi possível gerar a tabela.");
        return;
      }
      if (hasGroups) setDraw(result.draw);
      else router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={start}
        disabled={pending}
      >
        {pending && !draw ? "Gerando..." : "Gerar tabela e começar"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-body text-danger">
          {error}
        </p>
      )}
      {draw && (
        <GroupDrawOverlay
          draw={draw}
          closing={pending}
          onClose={() => startTransition(() => router.refresh())}
        />
      )}
    </>
  );
}

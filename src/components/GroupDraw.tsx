"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { startEditionAction } from "@/app/actions";
import { arcade } from "@/lib/labels";
import type { GroupDrawItem } from "@/lib/services";
import { useConfirm } from "./ConfirmDialog";
import { PlayerSprite } from "./PlayerSprite";
import { Stadium, Walker, prefersCalm } from "./stadium";

// Tempos de cada etapa do sorteio de um participante.
const NAME_SPIN_MS = 1300; // roleta de nomes no placar
const GROUP_SPIN_MS = 800; // roleta da letra do grupo
const SHOW_MS = 900; // nome e grupo parados no placar antes do próximo
const TICK_MS = 85; // troca de nome/letra nas roletas

type Phase = "name" | "group" | "show";

/** Placar eletrônico: sorteia o nome, depois a letra do grupo. */
function Scoreboard({
  draw,
  labels,
  placed,
  phase,
  tick,
}: {
  draw: GroupDrawItem[];
  labels: string[];
  placed: number;
  phase: Phase;
  tick: number;
}) {
  const done = placed >= draw.length;
  const current = draw[placed];
  const pool = draw.slice(placed);
  // Nas roletas os itens pulam de 3 em 3 para não parecerem em ordem.
  const spinning = pool.length ? pool[(tick * 3 + 1) % pool.length] : null;
  const shown = phase === "name" ? spinning : current;
  const letter =
    phase === "name"
      ? "?"
      : phase === "group"
        ? labels[tick % labels.length]
        : (current?.groupLabel ?? "?");

  return (
    <div className="scoreboard" aria-live="polite">
      <div className="flex items-center justify-between gap-3 font-pixel text-[8px] uppercase text-accent">
        <span>Sorteio dos grupos</span>
        <span className="num">
          {Math.min(placed + 1, draw.length)}/{draw.length}
        </span>
      </div>
      {done ? (
        <div className="flex min-h-[92px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-title text-accent">Grupos definidos</p>
          <p className="text-body text-muted">A tabela de jogos já está pronta.</p>
        </div>
      ) : (
        <div className="flex min-h-[92px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              // a chave reinicia a animação quando o nome para
              key={phase === "name" ? "spin" : current?.entryId}
              className={`truncate text-title ${
                phase === "name" ? "text-faint" : "animate-reveal"
              }`}
              aria-hidden={phase === "name"}
            >
              {arcade(shown?.playerName ?? "")}
            </p>
            <p className="mt-1 truncate text-body text-muted">
              {phase === "name" ? "Sorteando..." : (current?.teamName ?? "")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="font-pixel text-[8px] uppercase text-accent">
              Grupo
            </span>
            <span
              key={phase === "show" ? `ok-${current?.entryId}` : "spin"}
              className={`led scoreboard-letter ${
                phase === "show" ? "animate-reveal" : "text-faint"
              } ${phase === "name" ? "blink" : ""}`}
            >
              {letter}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sorteio dos grupos no estádio: o placar sorteia o nome e o grupo, o jogador
 * pula para fora do caminhão de lixo e vai se juntar aos outros na área do
 * grupo dele no gramado.
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
  // `placed`: quantos já foram sorteados por completo. O da vez entra em campo
  // assim que o grupo dele aparece no placar (fase "show").
  const [placed, setPlaced] = useState(0);
  const [phase, setPhase] = useState<Phase>("name");
  const [tick, setTick] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const tunnel = useRef<HTMLDivElement>(null);
  const done = placed >= draw.length;
  const remaining = draw.length - placed;

  useEffect(() => {
    if (done) return;
    if (phase === "show") {
      const next = setTimeout(() => {
        setPlaced((p) => p + 1);
        setPhase("name");
      }, SHOW_MS);
      return () => clearTimeout(next);
    }
    // Sem roleta para quem pediu menos movimento; e no último não há suspense.
    const quick = prefersCalm() || remaining === 1;
    const wait =
      phase === "name" ? (quick ? 350 : NAME_SPIN_MS) : quick ? 300 : GROUP_SPIN_MS;
    const flicker = setInterval(() => setTick((t) => t + 1), TICK_MS);
    const land = setTimeout(
      () => setPhase(phase === "name" ? "group" : "show"),
      wait,
    );
    return () => {
      clearInterval(flicker);
      clearTimeout(land);
    };
  }, [phase, done, remaining]);

  const labels = [...new Set(draw.map((d) => d.groupLabel ?? ""))].sort();
  const entered = Math.min(draw.length, placed + (phase === "show" ? 1 : 0));
  const zoneColumns =
    labels.length <= 2
      ? "grid-cols-2"
      : labels.length === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sorteio dos grupos"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-6">
        <Scoreboard
          draw={draw}
          labels={labels}
          placed={placed}
          phase={phase}
          tick={tick}
        />

        <Stadium tunnel={tunnel} entrance="truck">

          {/* Gramado: uma área por grupo, com um lugar para cada participante. */}
          <div className={`turf relative z-10 grid ${zoneColumns}`}>
            {labels.map((label) => {
              const members = draw
                .map((item, index) => ({ item, index }))
                .filter((m) => (m.item.groupLabel ?? "") === label);
              return (
                <div key={label} className="zone">
                  <h3 className="zone-label">Grupo {label}</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-x-1 gap-y-2">
                    {members.map(({ item, index }) => (
                      <div key={item.entryId} className="spot">
                        {index < entered && (
                          <Walker
                            walk={!skipped}
                            tunnel={tunnel}
                            className="flex w-full flex-col items-center gap-0.5"
                          >
                            <PlayerSprite name={item.playerName} />
                            <span className="field-name w-full truncate text-center">
                              {item.playerName}
                            </span>
                          </Walker>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Stadium>

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
                setSkipped(true);
                setPhase("name");
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
  manualGroups = false,
}: {
  editionId: number;
  hasGroups: boolean;
  /** Os grupos já foram montados à mão: não há sorteio para mostrar. */
  manualGroups?: boolean;
}) {
  const router = useRouter();
  const [draw, setDraw] = useState<GroupDrawItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();

  const start = async () => {
    const question = manualGroups
      ? "Gerar a tabela de jogos com os grupos que você montou?"
      : hasGroups
        ? "Sortear os grupos e gerar a tabela de jogos?"
        : "Sortear os confrontos e gerar a tabela de jogos?";
    if (!(await ask({ message: question, confirmLabel: "Gerar tabela" }))) return;
    setError(null);
    startTransition(async () => {
      const result = await startEditionAction(editionId);
      if (result.error || !result.draw) {
        setError(result.error ?? "Não foi possível gerar a tabela.");
        return;
      }
      if (hasGroups && !manualGroups) setDraw(result.draw);
      else router.refresh();
    });
  };

  return (
    <>
      {dialog}
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

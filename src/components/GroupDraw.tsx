"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { startEditionAction } from "@/app/actions";
import { arcade } from "@/lib/labels";
import type { GroupDrawItem } from "@/lib/services";
import { PlayerSprite } from "./PlayerSprite";

// Tempos de cada etapa do sorteio de um participante.
const NAME_SPIN_MS = 1300; // roleta de nomes no placar
const GROUP_SPIN_MS = 800; // roleta da letra do grupo
const SHOW_MS = 900; // nome e grupo parados no placar antes do próximo
const WALK_MS = 1500; // caminhada do túnel até o lugar no gramado
const TICK_MS = 85; // troca de nome/letra nas roletas

type Phase = "name" | "group" | "show";

const prefersCalm = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Jogador no gramado. Ao aparecer, sai de dentro do túnel e anda até o lugar
 * dele: o elemento já nasce na posição final e a animação o traz de lá.
 */
function FieldPlayer({
  item,
  walk,
  tunnel,
}: {
  item: GroupDrawItem;
  walk: boolean;
  tunnel: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Só na entrada: `walk` vale no momento em que o jogador aparece.
  useLayoutEffect(() => {
    const el = ref.current;
    const door = tunnel.current;
    if (!el || !door || !walk || prefersCalm()) return;
    const me = el.getBoundingClientRect();
    const from = door.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (me.left + me.width / 2);
    // Começa escondido atrás do muro, sobe reto até pisar no gramado (saindo
    // pela boca do túnel) e só então vai para o lugar dele.
    const hidden = from.top + 6 - me.top;
    const onPitch = from.top - me.height - 6 - me.top;
    const climb = hidden - onPitch;
    const cross = Math.hypot(dx, onPitch);
    el.classList.add("walking");
    const animation = el.animate(
      [
        { transform: `translate(${dx}px, ${hidden}px)` },
        {
          transform: `translate(${dx}px, ${onPitch}px)`,
          offset: climb / (climb + cross),
        },
        { transform: "none" },
      ],
      { duration: WALK_MS, easing: "steps(20, end)" },
    );
    animation.onfinish = () => el.classList.remove("walking");
    return () => {
      animation.cancel();
      el.classList.remove("walking");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="flex w-full flex-col items-center gap-0.5">
      <PlayerSprite name={item.playerName} />
      <span className="field-name w-full truncate text-center">
        {item.playerName}
      </span>
    </div>
  );
}

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
 * sai do túnel e vai se juntar aos outros na área do grupo dele no gramado.
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

        <div className="stadium">
          <div className="stands" />
          <div className="adboard" aria-hidden="true">
            <span>Copinha dos Lixos</span>
            <span>Copinha dos Lixos</span>
            <span className="hidden sm:inline">Copinha dos Lixos</span>
          </div>

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
                          <FieldPlayer item={item} walk={!skipped} tunnel={tunnel} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Muro com a boca do túnel: os jogadores saem de trás dele. */}
          <div className="tunnel-wall">
            <div ref={tunnel} className="tunnel-mouth" />
          </div>
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

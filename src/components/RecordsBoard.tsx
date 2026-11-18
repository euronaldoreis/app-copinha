"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AvatarLook } from "@/lib/sprite";
import { Avatar } from "./Avatar";
import { RecycleIcon, TrophyIcon } from "./icons";

export interface RecordPerson {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
}

/** Um recorde do mural, já pronto para mostrar (montado no servidor). */
export interface RecordItem {
  id: string;
  kind: "lenda" | "vexame";
  title: string;
  /** Frase de resenha embaixo do título. */
  tagline: string;
  layout:
    | { type: "single"; person: RecordPerson; value: number; unit: string }
    | {
        type: "versus";
        left: RecordPerson;
        right: RecordPerson;
        leftValue: number;
        rightValue: number;
        /** Rótulo embaixo de quem se deu mal (à direita); sem ele, ninguém é destacado. */
        loserLabel?: string;
      }
    | {
        type: "list";
        people: { person: RecordPerson; text: string }[];
        more: number;
      };
  detail: string;
  /** Texto para mandar no grupo. */
  share: string;
}

type Filter = "todos" | "lenda" | "vexame";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "lenda", label: "Lendas" },
  { id: "vexame", label: "Vexames" },
];

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Número que sobe de 0 até o valor quando `run` liga. */
function CountUp({ value, run }: { value: number; run: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!run) return;
    // Sem animação (ou número pequeno): o primeiro quadro já mostra o valor.
    const duration =
      reducedMotion() || value <= 1 ? 0 : Math.min(1400, 500 + value * 40);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, run]);
  return <span className="num">{run ? shown : 0}</span>;
}

/** Liga quando o elemento aparece na tela (uma vez só). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

export function RecordsBoard({ items }: { items: RecordItem[] }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const shown = items.filter((i) => filter === "todos" || i.kind === filter);
  const count = (k: Filter) =>
    k === "todos" ? items.length : items.filter((i) => i.kind === k).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rec-hero">
        <p className="font-pixel text-[22px] uppercase leading-tight">
          <span className="text-accent">Hall da fama</span> e{" "}
          <span className="text-[#ff9d8f]">do vexame</span>
        </p>
        <p className="text-body text-muted">
          Os feitos que ninguém esquece e os que todo mundo queria esquecer.
          Toque nos vexames para revelar o culpado.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filtrar recordes"
        className="grid grid-cols-3 gap-2"
      >
        {FILTERS.map((f) => (
          <button
            key={`${f.id}:${filter === f.id}`}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className="chip justify-center gap-1.5 !px-2"
          >
            {f.label}
            <span className="num text-[13px] opacity-80">{count(f.id)}</span>
          </button>
        ))}
      </div>

      <div key={filter} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shown.map((item, i) => (
          <RecordCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

function RecordCard({ item, index }: { item: RecordItem; index: number }) {
  const vexame = item.kind === "vexame";
  const [revealed, setRevealed] = useState(!vexame);
  const [justRevealed, setJustRevealed] = useState(false);
  const [ref, seen] = useSeen<HTMLElement>();
  const run = seen && revealed;

  function reveal() {
    setRevealed(true);
    setJustRevealed(true);
    if (!reducedMotion()) navigator.vibrate?.(60);
  }

  const shareUrl = () => {
    const link =
      typeof window === "undefined"
        ? ""
        : ` ${window.location.origin}/ranking?aba=recordes`;
    return `https://wa.me/?text=${encodeURIComponent(item.share + link)}`;
  };

  return (
    <article
      ref={ref}
      style={{ "--i": index } as React.CSSProperties}
      className={`rec-card ${vexame ? "rec-vexame" : "rec-lenda"} ${
        justRevealed ? "rec-shake" : ""
      }`}
    >
      <header className="flex items-start gap-3">
        <span className="rec-badge" aria-hidden="true">
          {vexame ? (
            <RecycleIcon width={22} height={22} />
          ) : (
            <TrophyIcon width={22} height={22} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-80">
            {vexame ? "Vexame" : "Lenda"}
          </p>
          <h3 className="font-pixel text-[20px] uppercase leading-tight">
            {item.title}
          </h3>
          <p className="text-body opacity-85">{item.tagline}</p>
        </div>
      </header>

      <div className="relative mt-3">
        <div aria-hidden={!revealed} className={revealed ? "" : "invisible"}>
          <RecordBody item={item} run={run} />
          <p className="mt-3 text-body opacity-80">{item.detail}</p>
          <a
            href={shareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={revealed ? 0 : -1}
            className="rec-share mt-3"
          >
            {vexame ? "Zoar no grupo" : "Exaltar no grupo"}
          </a>
        </div>

        {!revealed && (
          <button type="button" onClick={reveal} className="rec-cover">
            <span className="rec-tape">Censurado · Censurado · Censurado</span>
            <span className="font-pixel text-[22px] uppercase">Quem foi?</span>
            <span className="text-body font-black">Toque para revelar</span>
            <span className="rec-tape rec-tape-2">
              Vexame · Vexame · Vexame
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

function PersonLink({
  person,
  size,
  dim = false,
}: {
  person: RecordPerson;
  size: number;
  dim?: boolean;
}) {
  return (
    <Link
      href={`/jogadores/${person.id}`}
      className={`flex min-w-0 flex-col items-center gap-1.5 ${dim ? "rec-dim" : ""}`}
    >
      <span className="rec-avatar">
        <Avatar
          name={person.name}
          photoUrl={person.photoUrl}
          avatar={person.avatar}
          size={size}
        />
      </span>
      <span className="text-title w-full truncate text-center !text-[17px]">
        {person.name}
      </span>
    </Link>
  );
}

function RecordBody({ item, run }: { item: RecordItem; run: boolean }) {
  const l = item.layout;
  if (l.type === "single") {
    return (
      <div className="flex items-center gap-4">
        <PersonLink person={l.person} size={84} dim={item.kind === "vexame"} />
        <div className="min-w-0 flex-1 text-center">
          <p className="rec-number">
            <CountUp value={l.value} run={run} />
          </p>
          <p className="text-[13px] font-black uppercase tracking-wider opacity-85">
            {l.unit}
          </p>
        </div>
      </div>
    );
  }
  if (l.type === "versus") {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <PersonLink person={l.left} size={68} />
        <p className="rec-number !text-[40px]">
          <CountUp value={l.leftValue} run={run} />
          <span className="mx-1.5 align-middle text-[24px] opacity-80">x</span>
          <CountUp value={l.rightValue} run={run} />
        </p>
        <div className="flex min-w-0 flex-col items-center">
          <PersonLink person={l.right} size={68} dim={!!l.loserLabel} />
          {l.loserLabel && <span className="rec-loser">{l.loserLabel}</span>}
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {l.people.map(({ person, text }, i) => (
        <li key={i} className="flex items-center gap-3">
          <Link
            href={`/jogadores/${person.id}`}
            className="rec-avatar shrink-0"
          >
            <Avatar
              name={person.name}
              photoUrl={person.photoUrl}
              avatar={person.avatar}
              size={44}
            />
          </Link>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black">{person.name}</span>
            <span className="block truncate text-body opacity-80">{text}</span>
          </span>
        </li>
      ))}
      {l.more > 0 && <li className="text-body opacity-80">e mais {l.more}</li>}
    </ul>
  );
}

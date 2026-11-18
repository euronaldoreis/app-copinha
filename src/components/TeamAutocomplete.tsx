"use client";

import { useId, useMemo, useRef, useState } from "react";
import { TeamShield } from "./TeamShield";

/** Sem acento e em minúsculas, para "ibis" achar "Íbis". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

const MAX = 8;

/**
 * Campo de time com sugestões dos times já cadastrados. Aceita digitar um
 * time novo; a lista só ajuda a escolher (com o escudo de cada um). Times já
 * escolhidos por outro participante aparecem marcados, no fim da lista.
 */
export function TeamAutocomplete({
  name,
  value,
  onChange,
  options,
  taken = [],
  ariaLabel,
  className = "",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** Times de outros participantes desta edição. */
  taken?: string[];
  ariaLabel: string;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-lista`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const takenSet = useMemo(() => new Set(taken.map(fold)), [taken]);
  const matches = useMemo(() => {
    const q = fold(value);
    const scored = options
      .filter((o) => fold(o) !== q || q === "")
      .map((o) => {
        const f = fold(o);
        const rank = !q ? 1 : f.startsWith(q) ? 0 : f.includes(q) ? 1 : -1;
        return { o, rank, used: takenSet.has(f) };
      })
      .filter((x) => x.rank >= 0);
    scored.sort(
      (a, b) =>
        Number(a.used) - Number(b.used) ||
        a.rank - b.rank ||
        a.o.localeCompare(b.o, "pt-BR"),
    );
    return scored.slice(0, MAX);
  }, [options, value, takenSet]);

  const show = open && matches.length > 0;

  function pick(team: string) {
    onChange(team);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        name={name}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          show && active >= 0 ? `${listId}-${active}` : undefined
        }
        placeholder="Time"
        className="field w-full"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Enter" && show && active >= 0) {
            e.preventDefault();
            pick(matches[active].o);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="team-ac-list">
          {matches.map(({ o, used }, i) => (
            <li
              key={o}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown antes do blur do campo: a escolha não se perde
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`team-ac-item ${i === active ? "team-ac-on" : ""} ${used ? "opacity-60" : ""}`}
            >
              <TeamShield team={o} size={24} />
              <span className="min-w-0 flex-1 truncate">{o}</span>
              {used && (
                <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                  Já escolhido
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

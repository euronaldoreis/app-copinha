"use client";

import { useEffect, useState, type ReactNode } from "react";

const KEY = "copinha:classificacao";

/** Poucas colunas: pontos, jogos e saldo. */
function CompactIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

/** Tabela cheia: todas as colunas. */
function FullIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9 4.5v15M15 4.5v15" />
    </svg>
  );
}

/**
 * Escolha entre a classificação resumida (no celular: pontos, jogos e saldo) e
 * a completa (com vitórias, empates, derrotas e gols). A escolha fica guardada.
 * No computador a tabela já é completa, então a opção só aparece no celular.
 * `aside` fica na mesma linha, à esquerda (ex.: o botão de rever o sorteio).
 */
export function StandingsToggle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    try {
      // lida depois de montar, para não desencontrar do HTML do servidor
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "completa") setFull(true);
    } catch {}
  }, []);
  const choose = (value: boolean) => {
    setFull(value);
    try {
      localStorage.setItem(KEY, value ? "completa" : "resumida");
    } catch {}
  };
  return (
    <div className={full ? "st-full" : undefined}>
      {/* Sem `aside`, a linha só existe no celular (onde há o seletor). */}
      <div className={`mb-4 flex items-center justify-between gap-2 ${aside ? "" : "sm:hidden"}`}>
        <div>{aside}</div>
        <div className="st-switch sm:hidden" role="group" aria-label="Visualização da tabela">
          <button
            type="button"
            aria-pressed={!full}
            aria-label="Tabela resumida"
            title="Resumida"
            onClick={() => choose(false)}
          >
            <CompactIcon />
          </button>
          <button
            type="button"
            aria-pressed={full}
            aria-label="Tabela completa"
            title="Completa"
            onClick={() => choose(true)}
          >
            <FullIcon />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

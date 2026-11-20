"use client";

import { useEffect, useState, type ReactNode } from "react";

const KEY = "copinha:classificacao";

/**
 * Escolha entre a classificação resumida (no celular: pontos, jogos e saldo) e
 * a completa (com vitórias, empates, derrotas e gols). A escolha fica guardada.
 * No computador a tabela já é completa, então a opção só aparece no celular.
 */
export function StandingsToggle({ children }: { children: ReactNode }) {
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
      <div className="mb-3 flex justify-end sm:hidden">
        <div className="st-switch" role="group" aria-label="Visualização da tabela">
          <button type="button" aria-pressed={!full} onClick={() => choose(false)}>
            Resumida
          </button>
          <button type="button" aria-pressed={full} onClick={() => choose(true)}>
            Completa
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

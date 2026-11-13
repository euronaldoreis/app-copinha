"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Abas simples. O conteúdo de todas vem pronto do servidor; aqui só se escolhe
 * qual mostrar. O estado fica no navegador, então lançar um placar (que
 * atualiza a página) não tira a pessoa da aba em que estava.
 */
export function Tabs({
  tabs,
  initial,
}: {
  tabs: TabItem[];
  initial?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.id === initial) ? initial! : tabs[0]?.id,
  );
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="mt-10">
      <div role="tablist" className="-mx-1 mb-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`aba-${t.id}`}
            aria-selected={t.id === current.id}
            aria-controls={`painel-${t.id}`}
            className="chip"
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`painel-${current.id}`}
        aria-labelledby={`aba-${current.id}`}
      >
        {current.content}
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Ícone ao lado do nome (herda a cor do botão). */
  icon?: ReactNode;
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
    <div className="mt-8">
      <div role="tablist" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
        {tabs.map((t) => (
          <button
            // Recria o botão ao mudar de ativo (repintura no Safari do iPhone).
            key={`${t.id}:${t.id === current.id}`}
            type="button"
            role="tab"
            id={`aba-${t.id}`}
            aria-selected={t.id === current.id}
            aria-controls={`painel-${t.id}`}
            className="chip gap-2"
            onClick={() => setActive(t.id)}
          >
            {t.icon}
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

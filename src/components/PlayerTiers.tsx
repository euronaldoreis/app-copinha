"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { badgeKey } from "@/lib/teamBadge";

// Categoria de cada jogador (nome em minúsculas -> campeao, esmeralda...), lida
// uma vez no layout. Define a cor da moldura do retrato em qualquer tela.
const TiersContext = createContext<Record<string, string>>({});

export function PlayerTiersProvider({
  tiers,
  children,
}: {
  tiers: Record<string, string>;
  children: ReactNode;
}) {
  return <TiersContext.Provider value={tiers}>{children}</TiersContext.Provider>;
}

/**
 * Moldura do retrato na cor da categoria do jogador (a mesma das cartas). Sem
 * `tier`, usa a categoria do jogador pelo nome; quem ainda não tem categoria
 * fica com a moldura escura.
 */
export function TierRing({
  name,
  tier,
  size,
  children,
}: {
  name: string;
  tier?: string | null;
  size: number;
  children: ReactNode;
}) {
  const tiers = useContext(TiersContext);
  const t = tier ?? tiers[badgeKey(name)] ?? "participou";
  // A borda colorida acompanha o tamanho do retrato.
  const ring = Math.max(2, Math.round(size * 0.05));
  return (
    <span
      className={`lb-avatar lb-ring-${t}`}
      style={{ "--ring": `${ring}px` } as CSSProperties}
    >
      {children}
    </span>
  );
}

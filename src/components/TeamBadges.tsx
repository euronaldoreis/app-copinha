/* eslint-disable @next/next/no-img-element -- escudos vêm da API-Football ou de links quaisquer */
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { badgeKey } from "@/lib/teamBadge";

// Escudos dos times (nome em minúsculas -> link), lidos uma vez no layout e
// usados por todos os TeamShield da página.
const BadgesContext = createContext<Record<string, string>>({});

export function TeamBadgesProvider({
  badges,
  children,
}: {
  badges: Record<string, string>;
  children: ReactNode;
}) {
  return <BadgesContext.Provider value={badges}>{children}</BadgesContext.Provider>;
}

export function useTeamBadge(team: string | null) {
  const badges = useContext(BadgesContext);
  return team ? badges[badgeKey(team)] : undefined;
}

/**
 * Mostra o escudo cadastrado do time no lugar do escudo padrão (children), no
 * mesmo tamanho. Sem escudo, ou se a imagem não carregar, fica o padrão.
 */
export function BadgeOrShield({
  team,
  url,
  width,
  height,
  children,
}: {
  team: string | null;
  url?: string | null;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const fromContext = useTeamBadge(team);
  const src = url ?? fromContext;
  const [failed, setFailed] = useState<string | null>(null);
  // A imagem já vem no HTML do servidor e pode falhar antes de a página ficar
  // interativa (o onError não pega). Confere de novo no navegador; do cache é
  // instantâneo.
  useEffect(() => {
    if (!src) return;
    const probe = new window.Image();
    probe.onerror = () => setFailed(src);
    probe.src = src;
    return () => {
      probe.onerror = null;
    };
  }, [src]);
  if (!src || failed === src) return children;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
      className="team-badge-img shrink-0"
      style={{ width, height }}
    />
  );
}

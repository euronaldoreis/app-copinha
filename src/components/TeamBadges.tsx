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
 * Escudo do time dentro da moldura do TeamShield (coordenadas do viewBox
 * 48x54). Sem escudo, ou se a imagem não carregar, some e fica a sigla.
 */
export function ShieldLogo({ team, url }: { team: string | null; url?: string | null }) {
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
  if (!src || failed === src) return null;
  return (
    <g>
      <path
        d="M11 8h26a2.5 2.5 0 0 1 2.5 2.5v20.8L24 45 8.5 31.3V10.5A2.5 2.5 0 0 1 11 8Z"
        fill="#f6f7fb"
        stroke="#b8860b"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <image
        href={src}
        x="12"
        y="10"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
        onError={() => setFailed(src)}
      />
    </g>
  );
}

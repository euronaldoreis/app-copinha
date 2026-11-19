import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AvatarLook } from "@/lib/sprite";
import { Avatar } from "./Avatar";

/** Brasão com a posição: ouro, prata e bronze para os três primeiros. */
export function RankBadge({ place }: { place: number }) {
  const medal =
    place === 1
      ? "lb-gold"
      : place === 2
        ? "lb-silver"
        : place === 3
          ? "lb-bronze"
          : "";
  return (
    <span className={`lb-badge ${medal}`} aria-label={`${place}º lugar`}>
      <span className="num">{place}</span>
    </span>
  );
}

/** Retrato do jogador com a moldura da categoria dele (campeão, esmeralda...). */
export function PlayerMedia({
  name,
  photoUrl,
  avatar,
  tier,
  size = 44,
}: {
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  tier: string;
  size?: number;
}) {
  return (
    <span className={`lb-avatar lb-ring-${tier}`}>
      <Avatar name={name} photoUrl={photoUrl} avatar={avatar} size={size} />
    </span>
  );
}

/**
 * Card de jogador (ou time) em lista: posição, retrato, nome com resumo e, à
 * direita, um número em destaque. Posição e número são opcionais; `children`
 * entra embaixo, fora do link (ex.: controles do organizador).
 */
export function LeaderRow({
  place,
  href,
  media,
  name,
  sub,
  value,
  unit,
  trailing,
  me = false,
  index,
  children,
}: {
  place?: number;
  href?: string;
  media: ReactNode;
  name: string;
  sub?: ReactNode;
  value?: ReactNode;
  unit?: string;
  /** No lugar do número, quando não há um (ex.: escudo do time). */
  trailing?: ReactNode;
  me?: boolean;
  /** Ordem na lista, para a entrada em cascata. */
  index: number;
  children?: ReactNode;
}) {
  const body = (
    <>
      {place != null && <RankBadge place={place} />}
      {media}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-name font-black">{name}</span>
          {me && <span className="lb-me-tag">Você</span>}
        </span>
        {sub && (
          <span className="block truncate text-body text-muted">{sub}</span>
        )}
      </span>
      {value != null ? (
        <span className="flex shrink-0 flex-col items-end">
          <span className="lb-value">{value}</span>
          {unit && (
            <span className="text-[11px] font-black uppercase tracking-wider text-muted">
              {unit}
            </span>
          )}
        </span>
      ) : (
        trailing
      )}
    </>
  );
  const top = place != null && place <= 3 ? `lb-top lb-top-${place}` : "";
  const className = `lb-row ${top} ${me ? "lb-me" : ""}`;
  const style = { "--i": Math.min(index, 12) } as CSSProperties;
  if (children) {
    return (
      <div className={`${className} lb-row-stack`} style={style}>
        {href ? (
          <Link href={href} className="lb-row-main">
            {body}
          </Link>
        ) : (
          <div className="lb-row-main">{body}</div>
        )}
        <div className="lb-row-extra">{children}</div>
      </div>
    );
  }
  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

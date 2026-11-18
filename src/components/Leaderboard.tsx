import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

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

/**
 * Linha do placar: posição, retrato (ou escudo), nome com resumo e, à direita,
 * o número do critério escolhido em destaque.
 */
export function LeaderRow({
  place,
  href,
  media,
  name,
  sub,
  value,
  unit,
  me = false,
  index,
}: {
  place: number;
  href?: string;
  media: ReactNode;
  name: string;
  sub: ReactNode;
  value: ReactNode;
  unit: string;
  me?: boolean;
  /** Ordem na lista, para a entrada em cascata. */
  index: number;
}) {
  const body = (
    <>
      <RankBadge place={place} />
      {media}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-name font-black">{name}</span>
          {me && <span className="lb-me-tag">Você</span>}
        </span>
        <span className="block truncate text-body text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="lb-value">{value}</span>
        <span className="text-[11px] font-black uppercase tracking-wider text-muted">
          {unit}
        </span>
      </span>
    </>
  );
  const className = `lb-row ${place <= 3 ? `lb-top lb-top-${place}` : ""} ${me ? "lb-me" : ""}`;
  const style = { "--i": Math.min(index, 12) } as CSSProperties;
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

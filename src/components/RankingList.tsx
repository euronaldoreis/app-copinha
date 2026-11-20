"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AvatarLook } from "@/lib/sprite";
import { LeaderRow, PlayerMedia } from "./Leaderboard";

/** Números de um jogador no ranking (só o que o modal mostra). */
export interface RankingNumbers {
  titles: number;
  vices: number;
  thirds: number;
  finals: number;
  podiums: number;
  participations: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  pct: number | null;
  gf: number;
  ga: number;
  gd: number;
  best: string | null;
}

export interface RankingRow {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  tier: string;
  sub: string;
  value: number;
  unit: string;
  me: boolean;
  numbers: RankingNumbers;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "gold" | "good" | "bad" }) {
  return (
    <div className={`rk-stat ${tone ? `rk-${tone}` : ""}`}>
      <span className="num rk-stat-value">{value}</span>
      <span className="rk-stat-label">{label}</span>
    </div>
  );
}

/** Modal com os números do jogador; o card no topo leva ao perfil. */
function PlayerNumbers({ row, place, onClose }: { row: RankingRow; place: number; onClose: () => void }) {
  const n = row.numbers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Números de ${row.name}`} className="score-window rk-window">
        <button type="button" className="score-close" aria-label="Fechar" onClick={onClose} autoFocus>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </button>
        <LeaderRow
          index={0}
          place={place}
          href={`/jogadores/${row.id}`}
          me={row.me}
          media={<PlayerMedia name={row.name} photoUrl={row.photoUrl} avatar={row.avatar} tier={row.tier} size={52} />}
          name={row.name}
          sub={n.best ? `Melhor: ${n.best} · ver perfil` : "Ver perfil"}
          trailing={<span className="rk-go" aria-hidden="true">›</span>}
        />

        <p className="rk-title">Conquistas</p>
        <div className="rk-grid">
          <Stat label="Títulos" value={n.titles} tone="gold" />
          <Stat label="Vices" value={n.vices} />
          <Stat label="3º lugar" value={n.thirds} />
          <Stat label="Finais" value={n.finals} />
          <Stat label="Pódios" value={n.podiums} />
          <Stat label="Edições" value={n.participations} />
        </div>

        <p className="rk-title">Em campo</p>
        <div className="rk-grid">
          <Stat label="Jogos" value={n.played} />
          <Stat label="Pontos" value={n.points} tone="gold" />
          <Stat label="Aproveit." value={n.pct == null ? "–" : `${n.pct}%`} />
          <Stat label="Vitórias" value={n.wins} tone="good" />
          <Stat label="Empates" value={n.draws} />
          <Stat label="Derrotas" value={n.losses} tone="bad" />
          <Stat label="Gols pró" value={n.gf} tone="good" />
          <Stat label="Gols contra" value={n.ga} tone="bad" />
          <Stat label="Saldo" value={signed(n.gd)} />
        </div>
        {n.played > 0 && (
          <p className="mt-3 text-center text-[12px] font-bold text-[#dbe7ff]">
            {(n.gf / n.played).toFixed(1).replace(".", ",")} gols por jogo · {(n.ga / n.played).toFixed(1).replace(".", ",")} sofridos
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Lista do ranking de jogadores: tocar num jogador abre os números dele. */
export function RankingList({ rows }: { rows: RankingRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const selected = open == null ? null : rows[open];
  return (
    <>
      <div className="lb-list">
        {rows.map((r, i) => (
          <LeaderRow
            key={r.id}
            index={i}
            place={i + 1}
            onSelect={() => setOpen(i)}
            me={r.me}
            media={<PlayerMedia name={r.name} photoUrl={r.photoUrl} avatar={r.avatar} tier={r.tier} />}
            name={r.name}
            sub={r.sub}
            value={<span className="num">{r.value}</span>}
            unit={r.unit}
          />
        ))}
      </div>
      {selected && <PlayerNumbers row={selected} place={(open ?? 0) + 1} onClose={() => setOpen(null)} />}
    </>
  );
}

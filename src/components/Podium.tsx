import Link from "next/link";
import type { PlayerStats } from "@/lib/stats";
import { Avatar } from "./Avatar";
import { TrophyIcon } from "./icons";

const SLOTS = [
  // Ordem na tela: 2º, 1º, 3º.
  { place: 2, avatar: 60, height: 62, edge: "#dbe7ff", text: "text-[34px]" },
  { place: 1, avatar: 76, height: 92, edge: "#f5c542", text: "text-[46px]" },
  { place: 3, avatar: 54, height: 44, edge: "#f5a05a", text: "text-[28px]" },
];

function Crown() {
  return (
    <svg viewBox="0 0 28 28" width="34" height="34" aria-hidden="true">
      <g stroke="#0a1a52" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M4 21 2.5 8.5 9 13.5 14 5l5 8.5 6.5-5L24 21Z" fill="#ffc83d" />
        <path d="M4 21h20v3.5H4Z" fill="#f5a623" />
      </g>
    </svg>
  );
}

/** Pódio dos três primeiros: quem tem mais títulos fica no degrau mais alto. */
export function Podium({ top }: { top: PlayerStats[] }) {
  if (top.length < 3) return null;
  return (
    <section aria-label="Pódio" className="mb-6">
      <div className="flex items-end gap-2 px-1">
        {SLOTS.map(({ place, avatar, height, edge, text }) => {
          const r = top[place - 1];
          return (
            <Link
              key={place}
              href={`/jogadores/${r.player.id}`}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              {place === 1 && <Crown />}
              <Avatar
                name={r.player.name}
                photoUrl={r.player.photoUrl}
                avatar={r.player.avatar}
                size={avatar}
              />
              <span className="text-title w-full truncate text-center !text-[18px]">
                {r.player.name}
              </span>
              <span className="pill !h-7">
                <TrophyIcon width={16} height={16} className="text-accent" />
                <span className="num">{r.titles}</span>
              </span>
              <span
                className={`text-title flex w-full items-center justify-center rounded-t-[10px] border-[3px] border-b-0 ${text}`}
                style={{
                  height,
                  borderColor: edge,
                  background: "linear-gradient(#2f66d6,#1f4bb3)",
                  boxShadow: "0 0 0 2px #0a1a52",
                }}
              >
                {place}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-2.5 rounded-md border-2 border-[#4d7fe0] bg-[#0f2466]" />
    </section>
  );
}

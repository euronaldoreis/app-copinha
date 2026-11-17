import type { AvatarLook } from "@/lib/sprite";
import { teamCode, teamColor } from "@/lib/teamBadge";
import { Avatar } from "./Avatar";

export interface MatchSide {
  playerId: number;
  name: string;
  team: string | null;
  photoUrl?: string | null;
  avatar?: AvatarLook | null;
}

/** Escudo com a sigla do time, como no placar da TV. Sem time: escudo cinza com "?". */
export function TeamShield({ team, size = 46 }: { team: string | null; size?: number }) {
  const code = team ? teamCode(team) : "?";
  const fill = team ? teamColor(team) : "#8ea3cf";
  return (
    <svg
      viewBox="0 0 48 56"
      width={size}
      height={(size * 56) / 48}
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_3px_0_rgb(10_26_82_/_0.35)]"
    >
      <path
        d="M24 2 44 9v17c0 13-8.5 22-20 28C12.5 48 4 39 4 26V9Z"
        fill="#f2c230"
        stroke="#0a1a52"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M24 7.5 39.5 13v13c0 10-6.3 17.3-15.5 22.2C14.8 43.3 8.5 36 8.5 26V13Z" fill={fill} />
      <path d="M24 7.5 39.5 13v6.5C34 17 29 16.5 24 16.5S14 17 8.5 19.5V13Z" fill="#fff" opacity="0.18" />
      <text
        x="24"
        y="32"
        textAnchor="middle"
        className="font-pixel"
        fontSize="13"
        fill="#fff"
        stroke="#0a1a52"
        strokeWidth="2.5"
        paintOrder="stroke"
      >
        {code}
      </text>
    </svg>
  );
}

/** Escudo do time; em torneio sem times, o retrato do jogador. */
export function TeamBadge({ side, size = 46 }: { side: MatchSide; size?: number }) {
  return side.team ? (
    <TeamShield team={side.team} size={size} />
  ) : (
    <Avatar name={side.name} photoUrl={side.photoUrl} avatar={side.avatar} size={size} />
  );
}

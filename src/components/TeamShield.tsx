import type { AvatarLook } from "@/lib/sprite";
import { teamCode, teamColor } from "@/lib/teamBadge";
import { Avatar } from "./Avatar";
import { BadgeOrShield } from "./TeamBadges";

export interface MatchSide {
  playerId: number;
  name: string;
  team: string | null;
  photoUrl?: string | null;
  avatar?: AvatarLook | null;
}

/**
 * Escudo do time: o cadastrado no banco, se houver; senão, o padrão com a
 * sigla, como no placar da TV. Sem time: escudo cinza com "?".
 */
export function TeamShield({
  team,
  size = 46,
  badgeUrl,
}: {
  team: string | null;
  size?: number;
  /** Força uma imagem (ex.: prévia antes de salvar); sem isso, usa a cadastrada. */
  badgeUrl?: string | null;
}) {
  const code = team ? teamCode(team) : "?";
  const fill = team ? teamColor(team) : "#8ea3cf";
  const height = (size * 54) / 48;
  return (
    <BadgeOrShield team={team} url={badgeUrl} width={size} height={height}>
      <svg
        viewBox="0 0 48 54"
        width={size}
        height={height}
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_3px_0_rgb(10_26_82_/_0.35)]"
      >
        {/* moldura dourada: topo reto de cantos redondos, laterais retas e ponta embaixo */}
        <path
          d="M9 2.5h30a6 6 0 0 1 6 6V33L24 51.5 3 33V8.5a6 6 0 0 1 6-6Z"
          fill="#f2c230"
          stroke="#0a1a52"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 4.5h30a4 4 0 0 1 4 4v3H5v-3a4 4 0 0 1 4-4Z"
          fill="#ffe58a"
          opacity="0.7"
        />
        {/* campo na cor do time */}
        <path
          d="M11 8h26a2.5 2.5 0 0 1 2.5 2.5v20.8L24 45 8.5 31.3V10.5A2.5 2.5 0 0 1 11 8Z"
          fill={fill}
          stroke="#b8860b"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d="M11 8h26a2.5 2.5 0 0 1 2.5 2.5V19h-31v-8.5A2.5 2.5 0 0 1 11 8Z"
          fill="#fff"
          opacity="0.16"
        />
        <text
          x="24"
          y="27"
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
    </BadgeOrShield>
  );
}

/** Escudo do time; em torneio sem times, o retrato do jogador. */
export function TeamBadge({
  side,
  size = 46,
}: {
  side: MatchSide;
  size?: number;
}) {
  return side.team ? (
    <TeamShield team={side.team} size={size} />
  ) : (
    <Avatar
      name={side.name}
      photoUrl={side.photoUrl}
      avatar={side.avatar}
      size={size}
    />
  );
}

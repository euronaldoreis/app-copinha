/* eslint-disable @next/next/no-img-element -- as fotos vêm de links externos quaisquer */

// Sem foto, cada jogador ganha um retrato de desenho animado, sempre o mesmo
// para o mesmo nome (ver src/lib/sprite.ts).
import { spriteLook, type AvatarLook } from "@/lib/sprite";

// Cabelo de cada corte (mesma ordem de HAIR_STYLES): curto, comprido, careca e topete.
const HAIR_PATHS = [
  "M14.5 19C13 6 35 6 33.5 19 30 13.5 18 13.5 14.5 19Z",
  "M14 31C9 5 39 5 34 31l-2.5-1C35 14 13 14 16.5 30Z",
  "",
  "M14.5 19C12 9 22 3 35 8c-3 2-.5 6-1.5 11C30 14 18 14 14.5 19Z",
];
// Fundo do retrato, um por corte, para a lista não ficar toda da mesma cor.
const BACKGROUNDS = ["#ffd9a8", "#c8f0c0", "#e6d0ff", "#a9d6ff"];

function Portrait({ name, avatar }: { name: string; avatar?: AvatarLook | null }) {
  const look = spriteLook(name, avatar);
  const { S: skin, H: hair, J: shirt } = look.colors;
  const line = { stroke: "#0a1a52", strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" className="block size-full">
      <rect width="48" height="48" fill={BACKGROUNDS[look.style]} />
      <path d="M11.5 49C11.5 39 16 35 24 35s12.5 4 12.5 14Z" fill={shirt} strokeWidth="2.5" {...line} />
      <rect x="20.5" y="28" width="7" height="8.5" fill={skin} strokeWidth="2.5" {...line} />
      <ellipse cx="24" cy="20" rx="9.5" ry="10.5" fill={skin} strokeWidth="2.5" {...line} />
      {HAIR_PATHS[look.style] && (
        <path d={HAIR_PATHS[look.style]} fill={hair} strokeWidth="2.5" {...line} />
      )}
      <circle cx="20.3" cy="21" r="1.5" fill="#0a1a52" />
      <circle cx="27.7" cy="21" r="1.5" fill="#0a1a52" />
      <path d="M20.5 25.5Q24 28.5 27.5 25.5" fill="none" stroke="#0a1a52" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({
  name,
  photoUrl,
  avatar,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  /** Aparência escolhida do boneco; sem ela, vale a automática do nome. */
  avatar?: AvatarLook | null;
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className="block shrink-0 overflow-hidden rounded-[22%] border-2 border-night bg-wash shadow-soft"
      aria-hidden="true"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <Portrait name={name} avatar={avatar} />
      )}
    </span>
  );
}

/* eslint-disable @next/next/no-img-element -- as fotos vêm de links externos quaisquer */

// Sem foto, cada jogador ganha um retrato em pixel art, sempre o mesmo para o
// mesmo nome (ver src/lib/sprite.ts).
import { pixelRects, spriteLook } from "@/lib/sprite";

// H cabelo, S pele, E olho, M boca, J camisa, C gola. Grade de 12x12.
const BODY = [
  "....SSSS....",
  "..JJCSSCJJ..",
  ".JJJJCCJJJJ.",
  "JJJJJJJJJJJJ",
  "JJJJJJJJJJJJ",
];
const HEADS = [
  // curto
  [
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HSSSSSSH..",
    "..SESSSSES..",
    "..SSSSSSSS..",
    "...SSMMSS...",
  ],
  // comprido
  [
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    ".HHSSSSSSHH.",
    ".HSESSSSESH.",
    ".HSSSSSSSSH.",
    ".HHSSMMSSHH.",
  ],
  // careca
  [
    "............",
    "....SSSS....",
    "...SSSSSS...",
    "..HSSSSSSH..",
    "..SESSSSES..",
    "..SSSSSSSS..",
    "...SSMMSS...",
  ],
  // topete
  [
    "...HHHH.....",
    "..HHHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSSH..",
    "..SESSSSES..",
    "..SSSSSSSS..",
    "...SSMMSS...",
  ],
];

function Portrait({ name }: { name: string }) {
  const look = spriteLook(name);
  const rects = pixelRects([...HEADS[look.style], ...BODY], look.colors);
  return (
    <svg viewBox="0 0 12 12" shapeRendering="crispEdges" className="block size-full">
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className="block shrink-0 overflow-hidden border-2 border-night bg-wash shadow-soft"
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
        <Portrait name={name} />
      )}
    </span>
  );
}

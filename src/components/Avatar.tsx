/* eslint-disable @next/next/no-img-element -- as fotos vêm de links externos quaisquer */

// Sem foto, cada jogador ganha um bonequinho em pixel art, sempre o mesmo para
// o mesmo nome: tom de pele, cabelo, corte e camisa saem das letras do nome.

const SKIN = ["#f6c9a0", "#e2a877", "#b97a4e", "#8a5632"];
const HAIR = ["#1d1a1a", "#4a2c17", "#8c5a2b", "#d8a531", "#b9b9c4"];
/** [camisa, gola] */
const SHIRT = [
  ["#e23b2e", "#ffffff"],
  ["#2f6fe0", "#ffffff"],
  ["#ffd42a", "#1c9440"],
  ["#1c9440", "#ffffff"],
  ["#f6f6fa", "#1a2670"],
  ["#111122", "#e23b2e"],
  ["#f08a1c", "#111122"],
  ["#7a3fd1", "#ffd42a"],
  ["#19b5c9", "#111122"],
];

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

function hash(text: string) {
  let h = 7;
  for (const ch of text.toLocaleLowerCase("pt-BR")) {
    h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  }
  return h;
}

function Sprite({ name }: { name: string }) {
  const h = hash(name);
  const [shirt, collar] = SHIRT[(h >>> 6) % SHIRT.length];
  const colors: Record<string, string> = {
    H: HAIR[(h >>> 3) % HAIR.length],
    S: SKIN[h % SKIN.length],
    E: "#111122",
    M: "#7a2f2f",
    J: shirt,
    C: collar,
  };
  const rows = [...HEADS[(h >>> 10) % HEADS.length], ...BODY];
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let end = x;
      while (row[end] === ch) end++;
      if (ch !== ".") {
        rects.push(
          <rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={colors[ch]} />,
        );
      }
      x = end;
    }
  });
  return (
    <svg viewBox="0 0 12 12" shapeRendering="crispEdges" className="block size-full">
      {rects}
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
        <Sprite name={name} />
      )}
    </span>
  );
}

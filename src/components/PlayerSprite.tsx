// Jogador de corpo inteiro em pixel art (12x16), com as mesmas cores do
// retrato. As pernas têm dois quadros: parado e passo aberto. Dentro de um
// elemento com a classe "walking" eles se alternam (ver globals.css).
import { pixelRects, spriteLook } from "@/lib/sprite";

// Cabeça (linhas 0 a 5), um desenho por corte de cabelo.
const HEADS = [
  // curto
  [
    "....HHHH....",
    "...HHHHHH...",
    "...HSSSSH...",
    "...SESSES...",
    "...SSSSSS...",
    "....SMMS....",
  ],
  // comprido
  [
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSHH..",
    "..HSESSESH..",
    "..HSSSSSSH..",
    "..H.SMMS.H..",
  ],
  // careca
  [
    "............",
    "....SSSS....",
    "...SSSSSS...",
    "...SESSES...",
    "...SSSSSS...",
    "....SMMS....",
  ],
  // topete
  [
    "...HHHH.....",
    "...HHHHHH...",
    "...HHSSSH...",
    "...SESSES...",
    "...SSSSSS...",
    "....SMMS....",
  ],
];

// Tronco e calção (linhas 6 a 11).
const TORSO = [
  "..JJJCCJJJ..",
  ".JJJJJJJJJJ.",
  ".SJJJJJJJJS.",
  ".SJJJJJJJJS.",
  "...JJJJJJ...",
  "...PPPPPP...",
];

// Pernas (linhas 12 a 15): parado e passo aberto.
const LEGS_STANDING = [
  "...PP..PP...",
  "...SS..SS...",
  "...KK..KK...",
  "..BBB..BBB..",
];
const LEGS_STRIDE = [
  "...PP..PP...",
  "..SS....SS..",
  "..KK....KK..",
  ".BBB....BBB.",
];

export function PlayerSprite({
  name,
  width = 30,
}: {
  name: string;
  width?: number;
}) {
  const look = spriteLook(name);
  const draw = (rows: string[], offsetY: number) =>
    pixelRects(rows, look.colors, offsetY).map((r) => (
      <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
    ));
  return (
    <svg
      viewBox="0 0 12 16"
      width={width}
      height={(width * 16) / 12}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="block"
    >
      {draw([...HEADS[look.style], ...TORSO], 0)}
      <g className="legs-a">{draw(LEGS_STANDING, 12)}</g>
      <g className="legs-b">{draw(LEGS_STRIDE, 12)}</g>
    </svg>
  );
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagem de pré-visualização do link (WhatsApp, Telegram, redes sociais):
// 1200x630, no mesmo estilo de jogo 16 bits do site.
export const alt = "Copinha dos Lixos: o torneio de FIFA e Bomba Patch da galera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = await readFile(
  join(
    process.cwd(),
    "node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff",
  ),
);

const NIGHT = "#04051a";
const PANEL = "#1a2670";
const YELLOW = "#ffd42a";
const WHITE = "#f6f6fa";
const GREEN = "#1c9440";

const BALL = [
  "....####....",
  "..##....##..",
  ".#..####..#.",
  ".#.######.#.",
  "#..######..#",
  "#...####...#",
  "#.#......#.#",
  "###......###",
  ".##..##..##.",
  ".#..####..#.",
  "..##.##.##..",
  "....####....",
];

const TROPHY = [
  "............",
  ".##########.",
  ".#.######.#.",
  ".#.######.#.",
  ".##.####.##.",
  "...######...",
  "....####....",
  ".....##.....",
  ".....##.....",
  "....####....",
  "...######...",
  "............",
];

/** Desenho em pixels: cada "#" vira um quadrado de `px` pixels. */
function Pixels({
  rows,
  px,
  color,
}: {
  rows: string[];
  px: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, y) => (
        <div key={y} style={{ display: "flex" }}>
          {[...row].map((c, x) => (
            <div
              key={x}
              style={{
                width: px,
                height: px,
                background: c === "#" ? color : "transparent",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: NIGHT,
          fontFamily: "Press Start 2P",
          color: WHITE,
        }}
      >
        {/* Gramado listrado com as linhas do campo */}
        <div
          style={{
            display: "flex",
            height: 400,
            marginTop: 50,
            borderTop: `10px solid ${WHITE}`,
            borderBottom: `10px solid ${WHITE}`,
            background: `repeating-linear-gradient(90deg, ${GREEN} 0px, ${GREEN} 70px, #178038 70px, #178038 140px)`,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 80px",
          }}
        >
          <Pixels rows={BALL} px={16} color={WHITE} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 62,
                lineHeight: 1.2,
                textShadow: `6px 6px 0 ${NIGHT}`,
              }}
            >
              COPINHA
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 62,
                lineHeight: 1.2,
                color: YELLOW,
                textShadow: `6px 6px 0 ${NIGHT}`,
              }}
            >
              DOS LIXOS
            </div>
          </div>
          <Pixels rows={TROPHY} px={16} color={YELLOW} />
        </div>

        {/* Faixa de baixo: assunto do site, como o placar de um jogo */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "18px 40px",
              background: PANEL,
              border: `6px solid ${WHITE}`,
              fontSize: 30,
              color: YELLOW,
            }}
          >
            FIFA E BOMBA PATCH
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Press Start 2P", data: font, style: "normal", weight: 400 }],
    },
  );
}

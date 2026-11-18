import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagem de pré-visualização do link (WhatsApp, Telegram, redes sociais):
// 1200x630, no mesmo estilo de jogo do app (arena azul, dourado e contorno marinho).
export const alt = "Copinha dos Lixos: o torneio de FIFA e Bomba Patch da galera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [font, brasao] = await Promise.all([
  readFile(
    join(
      process.cwd(),
      "node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff",
    ),
  ),
  readFile(join(process.cwd(), "public/brasao.png")),
]);
const BRASAO_SRC = `data:image/png;base64,${brasao.toString("base64")}`;

const NIGHT = "#0a1a52";
const ROYAL = "#1c47ad";
const GOLD = "#ffc83d";
const WHITE = "#ffffff";
const BORDER = "#6ea0f5";
const GREEN = "#37a845";

/** Contorno marinho dos títulos, como no `.text-title` do app. */
const OUTLINE = (w: number) =>
  [
    [-w, 0],
    [w, 0],
    [0, -w],
    [0, w],
    [-w, -w],
    [w, -w],
    [-w, w],
    [w, w],
  ]
    .map(([x, y]) => `${x}px ${y}px 0 ${NIGHT}`)
    .join(", ");

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `repeating-linear-gradient(135deg, ${ROYAL} 0px, ${ROYAL} 46px, #2150b8 46px, #2150b8 92px)`,
          fontFamily: "Lilita One",
          color: WHITE,
        }}
      >
        {/* Moldura azul clara de painel, com sombra marinha */}
        <div
          style={{
            display: "flex",
            flex: 1,
            margin: 34,
            border: `6px solid ${BORDER}`,
            borderRadius: 36,
            boxShadow: `0 0 0 6px ${NIGHT}, 0 14px 0 6px ${NIGHT}`,
            background: "rgba(16,40,110,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 70px",
            gap: 64,
          }}
        >
          <img
            src={BRASAO_SRC}
            width={Math.round((380 * 147) / 192)}
            height={380}
            alt=""
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 148,
                lineHeight: 1,
                letterSpacing: 2,
                textShadow: `${OUTLINE(5)}, 0 10px 0 ${NIGHT}`,
              }}
            >
              COPINHA
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 148,
                lineHeight: 1,
                letterSpacing: 2,
                color: GOLD,
                textShadow: `${OUTLINE(5)}, 0 10px 0 ${NIGHT}`,
              }}
            >
              DOS LIXOS
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 44,
                padding: "10px 30px",
                borderRadius: 999,
                background: GREEN,
                border: `5px solid ${NIGHT}`,
                fontSize: 36,
                letterSpacing: 1,
                textShadow: `${OUTLINE(2)}`,
              }}
            >
              FIFA E BOMBA PATCH DA GALERA
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Lilita One", data: font, style: "normal", weight: 400 }],
    },
  );
}

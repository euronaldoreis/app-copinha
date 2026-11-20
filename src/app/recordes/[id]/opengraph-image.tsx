import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { RecordItem, RecordPerson } from "@/components/RecordsBoard";
import { getDb } from "@/db";
import { getData } from "@/lib/data";
import { isUploadedPhoto } from "@/lib/photo";
import { portraitSvg } from "@/lib/portrait";
import { recordItems } from "@/lib/recordItems";
import { getPlayerPhoto } from "@/lib/services";
import { computeRecords } from "@/lib/stats";

// Prévia do link de um recorde (WhatsApp, Telegram...): o próprio cartão do
// recorde ou do vexame, no estilo do mural.
export const alt = "Recorde da Copinha dos Lixos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Os recordes mudam a cada placar: a imagem é feita na hora.
export const dynamic = "force-dynamic";

const font = readFile(
  join(process.cwd(), "node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff"),
);
const brasao = readFile(join(process.cwd(), "public/brasao.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

const NIGHT = "#0a1a52";
const ROYAL = "#1c47ad";
const OUTLINE = (w: number) =>
  [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]]
    .map(([x, y]) => `${x}px ${y}px 0 ${NIGHT}`)
    .join(", ");

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** Foto do jogador como data URI; sem foto (ou se não der para baixar), o retrato desenhado. */
async function photoOf(p: RecordPerson): Promise<string> {
  const fallback = svgUri(portraitSvg(p.name, p.avatar));
  if (!p.photoUrl) return fallback;
  try {
    if (isUploadedPhoto(p.photoUrl)) {
      const photo = await getPlayerPhoto(getDb(), p.id);
      return photo && /png|jpe?g/.test(photo.contentType) ? `data:${photo.contentType};base64,${photo.data}` : fallback;
    }
    if (!/^https?:\/\//.test(p.photoUrl)) return fallback;
    const res = await fetch(p.photoUrl, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/png|jpe?g/.test(type)) return fallback;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return fallback;
  }
}

function Face({ src, size, dim = false }: { src: string; size: number; dim?: boolean }) {
  return (
    <div style={{ display: "flex", padding: 6, borderRadius: size * 0.26, background: "rgba(10,26,82,0.85)" }}>
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        style={{ borderRadius: size * 0.22, border: `4px solid ${NIGHT}`, objectFit: "cover", opacity: dim ? 0.85 : 1 }}
      />
    </div>
  );
}

const Num = ({ children, fontSize }: { children: React.ReactNode; fontSize: number }) => (
  <div style={{ display: "flex", fontSize, lineHeight: 1, color: "#ffffff", textShadow: `${OUTLINE(5)}, 0 8px 0 ${NIGHT}` }}>
    {children}
  </div>
);

const fmt = (n: number, decimals = 0) => n.toFixed(decimals).replace(".", ",");

async function Body({ item, ink }: { item: RecordItem; ink: string }) {
  const l = item.layout;
  const vexame = item.kind === "vexame";
  if (l.type === "single") {
    const src = await photoOf(l.person);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Face src={src} size={190} dim={vexame} />
          <div style={{ display: "flex", fontSize: 40, color: "#ffffff", textShadow: OUTLINE(3) }}>{l.person.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Num fontSize={170}>{`${l.prefix ?? ""}${l.value}`}</Num>
          <div style={{ display: "flex", fontSize: 40, color: ink, textTransform: "uppercase", marginTop: 6 }}>{l.unit}</div>
        </div>
      </div>
    );
  }
  if (l.type === "versus") {
    const [a, b] = await Promise.all([photoOf(l.left), photoOf(l.right)]);
    const side = (p: RecordPerson, src: string, loser?: string) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 300 }}>
        <Face src={src} size={160} dim={!!loser} />
        <div style={{ display: "flex", fontSize: 36, color: "#ffffff", textShadow: OUTLINE(3) }}>{p.name}</div>
        {loser && (
          <div style={{ display: "flex", padding: "2px 18px", borderRadius: 999, border: `4px solid ${NIGHT}`, background: "#ff6b5b", color: "#ffffff", fontSize: 26, textTransform: "uppercase" }}>
            {loser}
          </div>
        )}
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        {side(l.left, a)}
        <Num fontSize={130}>{`${l.leftValue} x ${l.rightValue}`}</Num>
        {side(l.right, b, l.loserLabel)}
      </div>
    );
  }
  if (l.type === "stat") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Num fontSize={180}>{fmt(l.value, l.decimals)}</Num>
        <div style={{ display: "flex", fontSize: 40, color: ink, textTransform: "uppercase" }}>{l.unit}</div>
        <div style={{ display: "flex", marginTop: 6, padding: "6px 24px", borderRadius: 999, border: `4px solid ${NIGHT}`, background: "rgba(10,26,82,0.8)", color: "#ffffff", fontSize: 32 }}>
          {l.caption}
        </div>
      </div>
    );
  }
  const shown = l.people.slice(0, 3);
  const srcs = await Promise.all(shown.map((p) => photoOf(p.person)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 900 }}>
      {shown.map(({ person, text }, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Face src={srcs[i]} size={74} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 38, color: "#ffffff", textShadow: OUTLINE(3) }}>{person.name}</div>
            <div style={{ display: "flex", fontSize: 26, color: ink }}>{text}</div>
          </div>
        </div>
      ))}
      {l.more + l.people.length - shown.length > 0 && (
        <div style={{ display: "flex", fontSize: 26, color: ink }}>{`e mais ${l.more + l.people.length - shown.length}`}</div>
      )}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = recordItems(computeRecords(await getData())).find((r) => r.id === id);
  const [fontData, brasaoSrc] = await Promise.all([font, brasao]);
  const vexame = item?.kind === "vexame";
  const ink = vexame ? "#ffd9d2" : "#3d2200";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `repeating-linear-gradient(135deg, ${ROYAL} 0px, ${ROYAL} 46px, #2150b8 46px, #2150b8 92px)`,
          fontFamily: "Lilita One",
        }}
      >
        {item ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 1110,
              height: 560,
              padding: "30px 44px",
              borderRadius: 40,
              border: `6px solid ${vexame ? "#ff9d8f" : "#ffe9a3"}`,
              boxShadow: `0 0 0 6px ${NIGHT}, 0 14px 0 6px ${NIGHT}`,
              background: vexame
                ? "linear-gradient(160deg, #7a1f2f 0%, #4b1020 60%, #2c0812 100%)"
                : "linear-gradient(160deg, #f9c23c 0%, #e49a12 55%, #b56a06 100%)",
              color: ink,
            }}
          >
            {/* Cabeçalho: tipo, título e a frase de resenha */}
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  display: "flex",
                  padding: "6px 20px",
                  borderRadius: 14,
                  border: `4px solid ${NIGHT}`,
                  background: vexame ? "#2c0812" : "#fff2c4",
                  color: vexame ? "#7cf06a" : "#b56a06",
                  fontSize: 30,
                  textTransform: "uppercase",
                }}
              >
                {vexame ? "Vexame" : "Lenda"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontSize: 54, lineHeight: 1.05, color: vexame ? "#ffffff" : "#3d2200", textTransform: "uppercase" }}>
                  {item.title}
                </div>
                <div style={{ display: "flex", fontSize: 28, opacity: 0.9 }}>{item.tagline}</div>
              </div>
              <img src={brasaoSrc} width={Math.round((96 * 147) / 192)} height={96} alt="" />
            </div>
            {/* O recorde */}
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
              {await Body({ item, ink })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, opacity: 0.9 }}>
              <span>{item.detail}</span>
              <span>COPINHA DOS LIXOS</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 90, color: "#ffffff", textShadow: OUTLINE(5) }}>RECORDES DA COPINHA</div>
        )}
      </div>
    ),
    { ...size, fonts: [{ name: "Lilita One", data: await fontData, style: "normal", weight: 400 }] },
  );
}

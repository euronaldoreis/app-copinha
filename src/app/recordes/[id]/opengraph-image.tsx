import { ImageResponse } from "next/og";
import type { RecordItem, RecordPerson } from "@/components/RecordsBoard";
import { getData } from "@/lib/data";
import { Face, NIGHT, OG_SIZE, OUTLINE, ROYAL, ogBrasao, ogFont, photoOf } from "@/lib/og";
import { recordItems } from "@/lib/recordItems";
import { computeRecords } from "@/lib/stats";

// Prévia do link de um recorde (WhatsApp, Telegram...): o próprio cartão do
// recorde ou do vexame, no estilo do mural.
export const alt = "Recorde da Copinha dos Lixos";
export const size = OG_SIZE;
export const contentType = "image/png";
// Os recordes mudam a cada placar: a imagem é feita na hora.
export const dynamic = "force-dynamic";

const font = ogFont;
const brasao = ogBrasao;

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

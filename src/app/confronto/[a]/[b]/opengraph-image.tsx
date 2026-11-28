import { ImageResponse } from "next/og";
import { Face, NIGHT, OG_SIZE, OUTLINE, ROYAL, ogBrasao, ogFont, photoOf } from "@/lib/og";
import { plural } from "@/lib/labels";
import { loadRivalry } from "../../load";

// Prévia do link do confronto (WhatsApp, Telegram...): os dois jogadores, as
// vitórias de cada um no meio e os números do duelo.
export const alt = "Confronto direto na Copinha dos Lixos";
export const size = OG_SIZE;
export const contentType = "image/png";
// O retrospecto muda a cada placar: a imagem é feita na hora.
export const dynamic = "force-dynamic";

const GOLD = "#ffc83d";
const BLUE = "#4fb6ff";

export default async function Image({ params }: { params: Promise<{ a: string; b: string }> }) {
  const { a: rawA, b: rawB } = await params;
  const loaded = await loadRivalry(rawA, rawB);
  const [fontData, brasaoSrc] = await Promise.all([ogFont, ogBrasao]);
  const fonts = [{ name: "Lilita One", data: fontData, style: "normal" as const, weight: 400 as const }];
  const frame = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `repeating-linear-gradient(135deg, ${ROYAL} 0px, ${ROYAL} 46px, #2150b8 46px, #2150b8 92px)`,
    fontFamily: "Lilita One",
  } as const;

  if (!loaded) {
    return new ImageResponse(
      <div style={frame}>
        <div style={{ display: "flex", fontSize: 90, color: "#ffffff", textShadow: OUTLINE(5) }}>CONFRONTO</div>
      </div>,
      { ...size, fonts },
    );
  }

  const { a, b, rivalry } = loaded;
  const { record, knockouts, finals } = rivalry;
  const [srcA, srcB] = await Promise.all([photoOf(a), photoOf(b)]);
  const leader = record.wins > record.losses ? "a" : record.losses > record.wins ? "b" : null;

  const side = (name: string, src: string, color: string, lead: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 300 }}>
      <div
        style={{
          display: "flex",
          padding: 6,
          borderRadius: 60,
          background: lead ? color : "rgba(10,26,82,0.6)",
        }}
      >
        <Face src={src} size={196} />
      </div>
      <div style={{ display: "flex", fontSize: 50, color: "#ffffff", textShadow: OUTLINE(4), textTransform: "uppercase" }}>
        {name.length > 12 ? `${name.slice(0, 11)}…` : name}
      </div>
    </div>
  );
  const big = (n: number, color: string) => (
    <div style={{ display: "flex", fontSize: 190, lineHeight: 1, color, textShadow: `${OUTLINE(7)}, 0 12px 0 ${NIGHT}` }}>
      {String(n)}
    </div>
  );
  const facts = [
    plural(record.draws, "empate", "empates"),
    `gols ${record.gf} x ${record.ga}`,
    ...(finals.a + finals.b > 0 ? [`finais ${finals.a} x ${finals.b}`] : knockouts.a + knockouts.b > 0 ? [`mata-mata ${knockouts.a} x ${knockouts.b}`] : []),
  ];

  return new ImageResponse(
    (
      <div style={frame}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 1110,
            height: 560,
            padding: "26px 40px 24px",
            borderRadius: 40,
            border: "6px solid #4d7fe0",
            boxShadow: `0 0 0 6px ${NIGHT}, 0 14px 0 6px ${NIGHT}`,
            background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(255,200,61,0.3), rgba(255,200,61,0) 70%), linear-gradient(180deg, #1f4cb8 0%, #102a73 100%)",
            color: "#ffffff",
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 28, color: GOLD, letterSpacing: 4 }}>CONFRONTO DIRETO</div>
              <div style={{ display: "flex", fontSize: 30, color: "#dce6ff" }}>
                {plural(record.played, "jogo", "jogos")} na história da Copinha
              </div>
            </div>
            <img src={brasaoSrc} width={Math.round((88 * 147) / 192)} height={88} alt="" />
          </div>

          {/* Os dois lados e o placar de vitórias */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
            {side(a.name, srcA, GOLD, leader === "a")}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
                {big(record.wins, GOLD)}
                <div style={{ display: "flex", fontSize: 70, color: "#bcd0ff", textShadow: OUTLINE(4) }}>x</div>
                {big(record.losses, BLUE)}
              </div>
              <div style={{ display: "flex", fontSize: 30, color: "#bcd0ff", letterSpacing: 4 }}>VITÓRIAS</div>
            </div>
            {side(b.name, srcB, BLUE, leader === "b")}
          </div>

          {/* Rodapé com os números do duelo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14 }}>
              {facts.map((f) => (
                <div
                  key={f}
                  style={{
                    display: "flex",
                    padding: "4px 18px",
                    borderRadius: 999,
                    border: `4px solid ${NIGHT}`,
                    background: "rgba(10,26,82,0.75)",
                    fontSize: 28,
                    color: "#ffffff",
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#dce6ff" }}>COPINHA DOS LIXOS</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

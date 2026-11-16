// Atributos do jogador no formato de hexágono (como nos jogos de futebol de
// 16 bits): o contorno de fundo é o máximo e a forma colorida é o jogador.
import { ATTRIBUTES, type AttributeKey } from "@/lib/attributes";
import { Arcade } from "./Arcade";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 62; // hexágono externo (100)
const LABEL_RADIUS = 86;

/** Ponto do eixo `i` (0 = topo, seguindo em sentido horário) a `r` do centro. */
function point(i: number, r: number) {
  const angle = ((-90 + i * 60) * Math.PI) / 180;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)] as const;
}

const polygon = (radius: (i: number) => number) =>
  ATTRIBUTES.map((_, i) => point(i, radius(i)).join(",")).join(" ");

export function AttributeRadar({ values }: { values: Record<AttributeKey, number> }) {
  const summary = ATTRIBUTES.map((a) => `${a.name} ${values[a.key]}`).join(", ");
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[340px]"
      role="img"
      aria-label={`Atributos: ${summary}`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden="true">
        <g shapeRendering="crispEdges">
          <polygon
            points={polygon(() => RADIUS)}
            fill="var(--color-bevel-dark)"
            stroke="var(--color-faint)"
            strokeWidth="1.5"
          />
          {[0.25, 0.5, 0.75].map((f) => (
            <polygon
              key={f}
              points={polygon(() => RADIUS * f)}
              fill="none"
              stroke="var(--color-faint)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          ))}
          {ATTRIBUTES.map((a, i) => {
            const [x, y] = point(i, RADIUS);
            return (
              <line
                key={a.key}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="var(--color-faint)"
                strokeOpacity="0.35"
              />
            );
          })}
          <polygon
            points={polygon((i) => Math.max(2, (values[ATTRIBUTES[i].key] / 100) * RADIUS))}
            fill="var(--color-accent)"
            fillOpacity="0.28"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinejoin="miter"
          />
        </g>
      </svg>
      {ATTRIBUTES.map((a, i) => {
        const [x, y] = point(i, LABEL_RADIUS);
        return (
          <div
            key={a.key}
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center leading-none"
            style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
          >
            <div className="font-pixel text-[15px]">
              <Arcade>{a.label}</Arcade>
            </div>
            <div className="num mt-1 text-body text-accent">{values[a.key]}</div>
          </div>
        );
      })}
    </div>
  );
}

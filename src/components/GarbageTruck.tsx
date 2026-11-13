// Caminhão de lixo em pixel art, de lado: cabine à esquerda, caçamba com o
// símbolo de reciclagem e, na traseira, o compactor aberto por onde os
// jogadores saem no sorteio dos grupos. Desenhado numa grade de 61x26.
import { RECYCLE_PIXELS, pixelRects } from "@/lib/sprite";

const WHITE = "#f6f6fa";
const SHADE = "#c9cbe0";
const OUTLINE = "#04051a";
const GREEN = "#1c9440";
const STEEL = "#7b80ab";

/** Largura e altura do desenho, em pixels da grade. */
export const TRUCK_GRID = { width: 61, height: 26 };
/** Faixa horizontal (em pixels da grade) da boca do compactor, na traseira. */
export const TRUCK_HATCH = { x: 53, width: 7 };


function Wheel({ x }: { x: number }) {
  return (
    <>
      <rect x={x + 1} y={19} width={4} height={6} fill="#111122" />
      <rect x={x} y={20} width={6} height={4} fill="#111122" />
      <rect x={x + 2} y={21} width={2} height={2} fill={STEEL} />
    </>
  );
}

export function GarbageTruck({ width = 183 }: { width?: number }) {
  return (
    <svg
      viewBox={`0 0 ${TRUCK_GRID.width} ${TRUCK_GRID.height}`}
      width={width}
      height={(width * TRUCK_GRID.height) / TRUCK_GRID.width}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Caminhão de lixo"
      className="block"
    >
      {/* chassi */}
      <rect x={2} y={20} width={57} height={2} fill="#2a2e57" />

      {/* cabine */}
      <rect x={2} y={7} width={12} height={14} fill={OUTLINE} />
      <rect x={3} y={8} width={10} height={12} fill={WHITE} />
      <rect x={4} y={9} width={6} height={5} fill="#58c4f0" />
      <rect x={4} y={9} width={2} height={2} fill="#c7ecff" />
      <rect x={11} y={9} width={1} height={10} fill={SHADE} />
      <rect x={3} y={17} width={10} height={3} fill={GREEN} />
      <rect x={1} y={18} width={2} height={3} fill={STEEL} />
      <rect x={2} y={15} width={1} height={2} fill="#ffd42a" />
      {/* giroflex */}
      <rect x={7} y={5} width={3} height={2} fill="#f08a1c" className="blink" />

      {/* caçamba */}
      <rect x={15} y={2} width={38} height={19} fill={OUTLINE} />
      <rect x={16} y={3} width={36} height={17} fill={WHITE} />
      <rect x={16} y={17} width={36} height={3} fill={GREEN} />
      <rect x={51} y={3} width={1} height={14} fill={SHADE} />
      {pixelRects(RECYCLE_PIXELS, { "#": GREEN }, 3).map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x + 26}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}

      {/* compactor na traseira, aberto em cima */}
      <rect x={53} y={0} width={7} height={21} fill={OUTLINE} />
      <rect x={54} y={1} width={5} height={19} fill={STEEL} />
      <rect x={54} y={1} width={5} height={4} fill="#14173f" />
      <rect x={54} y={14} width={5} height={2} fill="#5d6290" />

      <Wheel x={5} />
      <Wheel x={38} />
      <Wheel x={45} />
    </svg>
  );
}

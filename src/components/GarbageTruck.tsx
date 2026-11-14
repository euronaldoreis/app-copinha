// Caminhão de lixo em pixel art, de lado: cabine amarela à esquerda, caçamba
// verde com painéis, três eixos e, na traseira inclinada, o compactor por onde
// os jogadores saem. Desenhado numa grade de 61x26.
const OUTLINE = "#04051a";
const YELLOW = "#ffb20f";
const YELLOW_DARK = "#d98a00";
const ORANGE = "#f07a12";
const GREEN = "#3fa84a";
const GREEN_LIGHT = "#5cc063";
const GREEN_DARK = "#2a8037";
const GLASS = "#8cc9f2";
const GLASS_SHINE = "#d9f0ff";
const STEEL = "#7b80ab";
const TANK = "#4a4f7a";
const TIRE = "#111122";

/** Largura e altura do desenho, em pixels da grade. */
export const TRUCK_GRID = { width: 61, height: 26 };
/** Faixa horizontal (em pixels da grade) da boca do compactor, na traseira. */
export const TRUCK_HATCH = { x: 53, width: 7 };

/** Roda grande de 8x8: pneu escuro com o aro cinza no meio. */
function Wheel({ x }: { x: number }) {
  return (
    <>
      <rect x={x + 2} y={18} width={4} height={8} fill={TIRE} />
      <rect x={x + 1} y={19} width={6} height={6} fill={TIRE} />
      <rect x={x} y={20} width={8} height={4} fill={TIRE} />
      <rect x={x + 2} y={20} width={4} height={4} fill={STEEL} />
      <rect x={x + 3} y={21} width={2} height={2} fill="#c9cbe0" />
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
      {/* chassi e tanque */}
      <rect x={2} y={19} width={58} height={3} fill="#2a2e57" />
      <rect x={20} y={18} width={9} height={5} fill={OUTLINE} />
      <rect x={21} y={19} width={7} height={3} fill={TANK} />

      {/* caçamba verde, com a faixa amarela embaixo */}
      <rect x={15} y={2} width={35} height={19} fill={OUTLINE} />
      <rect x={16} y={3} width={33} height={17} fill={GREEN_LIGHT} />
      {[17, 23, 29, 35, 41].map((x) => (
        <rect key={x} x={x} y={5} width={5} height={12} fill={GREEN_DARK} />
      ))}
      <rect x={16} y={3} width={33} height={1} fill={GREEN} />
      <rect x={16} y={17} width={33} height={1} fill={GREEN} />
      <rect x={16} y={18} width={33} height={2} fill={YELLOW} />

      {/* traseira inclinada, com a boca do compactor no alto */}
      <polygon
        points="49,2 55,2 60,8 60,21 49,21"
        fill={OUTLINE}
      />
      <polygon
        points="50,3 54,3 59,8 59,18 50,18"
        fill={GREEN}
      />
      <rect x={50} y={3} width={4} height={2} fill="#14173f" />
      <rect x={54} y={5} width={3} height={1} fill="#14173f" />
      <rect x={55} y={9} width={4} height={1} fill={GREEN_DARK} />
      <rect x={55} y={12} width={4} height={1} fill={GREEN_DARK} />
      <rect x={55} y={15} width={4} height={1} fill={GREEN_DARK} />
      <rect x={50} y={18} width={10} height={2} fill={YELLOW} />
      {/* braço hidráulico */}
      <rect x={50} y={6} width={2} height={2} fill={YELLOW} />
      <rect x={52} y={8} width={2} height={2} fill={YELLOW} />
      <rect x={54} y={10} width={2} height={2} fill={ORANGE} />

      {/* cabine amarela */}
      <rect x={1} y={7} width={14} height={14} fill={OUTLINE} />
      <rect x={2} y={8} width={12} height={12} fill={YELLOW} />
      <rect x={2} y={17} width={12} height={3} fill={YELLOW_DARK} />
      {/* janela e vidro da porta */}
      <rect x={3} y={9} width={7} height={6} fill={OUTLINE} />
      <rect x={4} y={10} width={5} height={4} fill={GLASS} />
      <rect x={4} y={10} width={2} height={1} fill={GLASS_SHINE} />
      <rect x={11} y={9} width={2} height={6} fill={OUTLINE} />
      <rect x={11} y={10} width={1} height={4} fill={GLASS} />
      {/* porta, maçaneta e retrovisor */}
      <rect x={10} y={8} width={1} height={12} fill={YELLOW_DARK} />
      <rect x={8} y={16} width={2} height={1} fill={YELLOW_DARK} />
      <rect x={0} y={8} width={2} height={4} fill={OUTLINE} />
      {/* farol e para-choque */}
      <rect x={1} y={16} width={2} height={2} fill="#f6f6fa" />
      <rect x={0} y={19} width={15} height={2} fill={OUTLINE} />
      <rect x={1} y={19} width={4} height={1} fill={STEEL} />

      <Wheel x={5} />
      <Wheel x={35} />
      <Wheel x={45} />
    </svg>
  );
}

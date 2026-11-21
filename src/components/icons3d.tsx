// Ícones coloridos com volume (degradê, brilho e contorno marinho), no estilo
// dos contadores de jogo. Diferente de icons.tsx, não herdam a cor do texto.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const OUTLINE = "#0a1a52";

/** Pontos de um pentágono com centro (cx, cy), raio r e giro em graus. */
function pentagon(cx: number, cy: number, r: number, turn = -90) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = ((turn + i * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

export function Trophy3D(props: P) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="t3d-gold" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#c9780a" />
          <stop offset="0.3" stopColor="#ffe680" />
          <stop offset="0.65" stopColor="#f7b520" />
          <stop offset="1" stopColor="#b8650a" />
        </linearGradient>
        <linearGradient id="t3d-wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a65a22" />
          <stop offset="1" stopColor="#5e2c0a" />
        </linearGradient>
      </defs>
      {/* alças: contorno escuro por baixo, ouro por cima */}
      <g fill="none" strokeLinecap="round">
        <path d="M8.5 7.5H4.8c0 4.6 2 7 4.9 7.6M23.5 7.5h3.7c0 4.6-2 7-4.9 7.6" stroke={OUTLINE} strokeWidth="4" />
        <path d="M8.5 7.5H4.8c0 4.6 2 7 4.9 7.6M23.5 7.5h3.7c0 4.6-2 7-4.9 7.6" stroke="#f7b520" strokeWidth="2" />
      </g>
      {/* base de madeira com plaquinha */}
      <rect x="8" y="25" width="16" height="5" rx="1.2" fill="url(#t3d-wood)" stroke={OUTLINE} strokeWidth="1.3" />
      <rect x="12.5" y="26.6" width="7" height="1.8" rx="0.5" fill="#ffd54a" />
      {/* pé e degrau */}
      <path d="M14.2 19.5h3.6l.8 3.4h-5.2Z" fill="url(#t3d-gold)" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="10.5" y="22.6" width="11" height="2.6" rx="0.8" fill="url(#t3d-gold)" stroke={OUTLINE} strokeWidth="1.2" />
      {/* taça */}
      <path
        d="M7.5 4.5h17V12c0 5.2-3.8 8.5-8.5 8.5S7.5 17.2 7.5 12Z"
        fill="url(#t3d-gold)"
        stroke={OUTLINE}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <ellipse cx="16" cy="4.8" rx="8.2" ry="1.5" fill="#fff3b8" stroke={OUTLINE} strokeWidth="1" />
      {/* estrela e brilho */}
      <path d="m16 8.3 1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3Z" fill="#fff6c9" opacity="0.9" />
      <path d="M10.6 7.5c-.4 3.6.3 6.5 2.3 8.8" fill="none" stroke="#fffbe6" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function Star3D(props: P) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="s3d-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff07a" />
          <stop offset="0.5" stopColor="#ffc21f" />
          <stop offset="1" stopColor="#e08a0a" />
        </linearGradient>
      </defs>
      <path
        d="m16 2.5 4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L16 23.6l-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3Z"
        fill="url(#s3d-gold)"
        stroke={OUTLINE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* face de baixo mais escura, para dar volume */}
      <path d="M16 16.5 22.6 18.7l1.6 9.2L16 23.6l-8.2 4.3 1.6-9.2Z" fill="#c9720a" opacity="0.35" />
      <path d="M11.6 12.4 16 6.4" stroke="#fffbe0" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      <circle cx="10.4" cy="13.2" r="1" fill="#fffbe0" opacity="0.9" />
    </svg>
  );
}

/** Três degraus do pódio: ouro no meio, prata à esquerda, bronze à direita. */
export function Podium3D(props: P) {
  const step = (x: number, y: number, w: number, top: string, front: string, n: string) => (
    <g>
      <rect x={x} y={y} width={w} height={29 - y} rx="1" fill={front} stroke={OUTLINE} strokeWidth="1.4" />
      <rect x={x + 1} y={y + 1} width={w - 2} height="2.2" fill={top} opacity="0.9" />
      <text
        x={x + w / 2}
        y={y + 9.5}
        textAnchor="middle"
        fontSize="7"
        fontWeight="900"
        fill="#fff"
        stroke={OUTLINE}
        strokeWidth="1.6"
        paintOrder="stroke"
        fontFamily="system-ui, sans-serif"
      >
        {n}
      </text>
    </g>
  );
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      {step(2, 15, 9.5, "#f4f7ff", "#a9b7d6", "2")}
      {step(20.5, 18.5, 9.5, "#ffd2a6", "#c8732f", "3")}
      {step(11, 9, 10, "#fff3a8", "#f2b21f", "1")}
      <rect x="1" y="28.5" width="30" height="2.2" rx="1" fill="#0a1a52" />
    </svg>
  );
}

const GEMS = {
  rubi: { hi: "#ffe0e6", light: "#ff7a94", mid: "#e0234a", dark: "#8a0d29" },
  esmeralda: { hi: "#dcffeb", light: "#5ef0a0", mid: "#17a85e", dark: "#075c32" },
};

/** Pedra lapidada, vista de lado: coroa com facetas em cima, pavilhão embaixo. */
export function Gem3D({ tone, ...props }: P & { tone: keyof typeof GEMS }) {
  const c = GEMS[tone];
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      {/* coroa */}
      <polygon points="9,5 3,12 11,12" fill={c.light} />
      <polygon points="9,5 11,12 16,5" fill={c.hi} />
      <polygon points="16,5 11,12 21,12" fill={c.light} />
      <polygon points="16,5 21,12 23,5" fill={c.hi} />
      <polygon points="23,5 21,12 29,12" fill={c.mid} />
      {/* pavilhão */}
      <polygon points="3,12 11,12 16,28" fill={c.mid} />
      <polygon points="11,12 21,12 16,28" fill={c.light} />
      <polygon points="21,12 29,12 16,28" fill={c.dark} />
      <path d="M3 12h26M11 12l5 16M21 12l-5 16M9 5l2 7M23 5l-2 7M16 5l-5 7M16 5l5 7" fill="none" stroke={c.dark} strokeWidth="0.6" opacity="0.7" />
      <path d="M9 5h14l6 7-13 16L3 12Z" fill="none" stroke={OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* brilho */}
      <path d="M7.4 10.6 9.6 7" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <path d="m26.5 1.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" fill="#ffffff" />
    </svg>
  );
}

export function Ball3D(props: P) {
  const outer = [0, 72, 144, 216, 288].map((deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: 16 + 11.6 * Math.cos(a), y: 16 + 11.6 * Math.sin(a), deg };
  });
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <defs>
        <radialGradient id="b3d-skin" cx="0.36" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e6eeff" />
          <stop offset="1" stopColor="#93a9da" />
        </radialGradient>
        <radialGradient id="b3d-patch" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4f8cff" />
          <stop offset="1" stopColor="#173a9e" />
        </radialGradient>
        <clipPath id="b3d-clip">
          <circle cx="16" cy="16" r="13" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#b3d-skin)" />
      <g clipPath="url(#b3d-clip)">
        {/* costuras do centro até os gomos de fora */}
        {outer.map((o) => {
          const a = ((o.deg - 90) * Math.PI) / 180;
          return (
            <line
              key={o.deg}
              x1={16 + 4.6 * Math.cos(a)}
              y1={16 + 4.6 * Math.sin(a)}
              x2={o.x}
              y2={o.y}
              stroke="#7f95c8"
              strokeWidth="1"
            />
          );
        })}
        {outer.map((o) => (
          <polygon key={o.deg} points={pentagon(o.x, o.y, 4.6, o.deg + 90)} fill="url(#b3d-patch)" />
        ))}
        <polygon points={pentagon(16, 16, 4.8)} fill="url(#b3d-patch)" />
      </g>
      <circle cx="16" cy="16" r="13" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
      <ellipse cx="11" cy="8.8" rx="3.6" ry="2" transform="rotate(-32 11 8.8)" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

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

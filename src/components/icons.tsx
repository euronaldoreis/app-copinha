// Ícones de contorno (traço de 2px, pontas redondas), no tamanho 24x24. Herdam
// a cor do texto (currentColor); o tamanho se muda com width/height.
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function icon(body: ReactNode) {
  return function Icon(props: P) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {body}
      </svg>
    );
  };
}

export const HomeIcon = icon(
  <>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    <path d="M9 21v-8h6v8" />
  </>,
);

/** Espadas cruzadas: a tela de edições (as batalhas). */
export const SwordsIcon = icon(
  <>
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
    <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
    <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
    <path d="m5 14 4 4M7 17l-3 3M3 19l2 2" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>,
);

export const ChartIcon = icon(
  <>
    <path d="M4 20V10M12 20V4M20 20v-7" />
  </>,
);

/** Carta de jogador: a tela de jogadores. */
export const CardIcon = icon(
  <>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="m12 8 2.6 4-2.6 4-2.6-4Z" />
  </>,
);

export const PeopleIcon = icon(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.4c2 .8 3.5 2.6 3.5 5.6" />
  </>,
);

export const TrophyIcon = icon(
  <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16M10 14.7V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.7V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0Z" />
  </>,
);

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);

/** Seta para a direita; gire 180° para voltar. */
export const ChevronIcon = icon(<path d="m9 5 7 7-7 7" />);

export const ShuffleIcon = icon(
  <>
    <path d="M3 7h3.5c2 0 3.2.9 4.3 2.5L13 13c1.1 1.6 2.3 2.5 4.3 2.5H21" />
    <path d="M3 17h3.5c2 0 3.2-.9 4.3-2.5M13 9.5C14.1 7.9 15.3 7 17.3 7H21" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 13l2.5 2.5-2.5 2.5" />
  </>,
);

export const LockIcon = icon(
  <>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 15v2" />
  </>,
);

export const LogoutIcon = icon(
  <>
    <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  </>,
);

export const PencilIcon = icon(
  <>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z" />
    <path d="m14.5 7.5 3 3" />
  </>,
);

export const BallIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 8 3.6 2.6-1.4 4.2H9.8l-1.4-4.2Z" />
    <path d="M12 8V3.2M15.6 10.6l4.6-1.5M14.2 14.8l2.9 3.9M9.8 14.8l-2.9 3.9M8.4 10.6 3.8 9.1" />
  </>,
);

// Três setas em roda (reciclagem), calculadas: cada uma é um arco de 78 graus
// com a ponta em triângulo.
const RECYCLE_ARROWS = [0, 120, 240].map((start) => {
  const at = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [12 + r * Math.cos(a), 12 + r * Math.sin(a)] as const;
  };
  const [x0, y0] = at(start + 14, 7.5);
  const [x1, y1] = at(start + 92, 7.5);
  const tip = at(start + 108, 7.5);
  const left = at(start + 86, 11.2);
  const right = at(start + 86, 3.8);
  return {
    arc: `M${x0.toFixed(2)} ${y0.toFixed(2)}A7.5 7.5 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    head: `M${left[0].toFixed(2)} ${left[1].toFixed(2)}L${tip[0].toFixed(2)} ${tip[1].toFixed(2)}L${right[0].toFixed(2)} ${right[1].toFixed(2)}Z`,
  };
});

export const RecycleIcon = icon(
  <>
    {RECYCLE_ARROWS.map((a, i) => (
      <g key={i}>
        <path d={a.arc} strokeWidth="3" />
        <path d={a.head} fill="currentColor" strokeWidth="1.5" />
      </g>
    ))}
  </>,
);

export const SaveIcon = icon(
  <>
    <path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M8 3v5h7V3M8 21v-7h8v7" />
  </>,
);

export const CheckIcon = icon(<path d="m4.5 12.5 5 5 10-11" />);

export const ExpandIcon = icon(
  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
);

export const TrashIcon = icon(
  <>
    <path d="M4 7h16M9.5 7V4.5h5V7" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </>,
);

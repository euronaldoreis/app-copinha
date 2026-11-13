// Ícones de linha fina, desenhados no próprio projeto (sem emojis na interface).
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const HomeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Icon>
);

export const CalendarIcon = (p: P) => (
  <Icon {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
  </Icon>
);

export const ChartIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 20v-7M12 20V5M18 20v-10" />
  </Icon>
);

export const PeopleIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.8c1.6.7 2.6 2.3 3 4.7" />
  </Icon>
);

export const TrophyIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 4.5h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5.5a2.5 2.5 0 0 0 2.7 4M16 6h2.5a2.5 2.5 0 0 1-2.7 4" />
    <path d="M12 13.5v3.5M8.5 20h7M9.5 17h5v3h-5z" />
  </Icon>
);

export const PlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChevronIcon = (p: P) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);

export const ShuffleIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 7h3.5c2.5 0 3.5 1.2 4.7 3.2l1.6 2.6c1.2 2 2.2 3.2 4.7 3.2H20" />
    <path d="M4 17h3.5c1.4 0 2.3-.4 3.1-1.2M20 7h-1.5c-1.4 0-2.3.4-3.1 1.2" />
    <path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5 20 17l-2.5 2.5" />
  </Icon>
);

export const LockIcon = (p: P) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Icon>
);

export const PencilIcon = (p: P) => (
  <Icon {...p}>
    <path d="m5 19 .8-3.6L15.5 5.7a1.7 1.7 0 0 1 2.4 0l.4.4a1.7 1.7 0 0 1 0 2.4L8.6 18.2z" />
  </Icon>
);

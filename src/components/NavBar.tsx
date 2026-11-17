"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ShirtIcon, SwordsIcon, TrophyIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/edicoes", label: "Edições", icon: SwordsIcon },
  { href: "/ranking", label: "Ranking", icon: TrophyIcon },
  { href: "/jogadores", label: "Lixos", icon: ShirtIcon },
];

/**
 * Menu fixo no rodapé, como a barra de um jogo. O botão aceso desliza até a aba
 * escolhida (com um leve "quique" no fim), o ícone dela pula e o rótulo acende.
 */
export function NavBar() {
  const pathname = usePathname();
  const current = ITEMS.findIndex(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href),
  );
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#2f56b8] bg-[#0f1b4d] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto grid w-full max-w-3xl grid-cols-4 px-1">
        {/* Trilho do botão aceso: ocupa a largura das 4 abas e a peça anda por ele. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-1 right-1"
        >
          <span
            className="nav-glow"
            style={{
              transform: `translateX(${Math.max(current, 0) * 100}%)`,
              opacity: current < 0 ? 0 : 1,
            }}
          />
        </span>
        {ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = i === current;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`nav-tab ${active ? "nav-tab-on" : ""}`}
            >
              <Icon width={26} height={26} className="nav-icon" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

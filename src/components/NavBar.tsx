"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardIcon, HomeIcon, SwordsIcon, TrophyIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/edicoes", label: "Edições", icon: SwordsIcon },
  { href: "/ranking", label: "Ranking", icon: TrophyIcon },
  { href: "/jogadores", label: "Jogadores", icon: CardIcon },
];

/** Menu fixo no rodapé, como a barra de um jogo: a aba atual vira um botão aceso. */
export function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="navbar fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-4 px-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="nav-item m-2 flex h-[60px] flex-col items-center justify-center gap-1.5 rounded-[10px] text-[11px] font-black uppercase tracking-wider"
            >
              <Icon width={26} height={26} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

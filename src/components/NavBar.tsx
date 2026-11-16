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
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#2f56b8] bg-[#0f1b4d] pb-[env(safe-area-inset-bottom)]"
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
              className={`relative m-2 flex h-[60px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 text-[11px] font-black uppercase tracking-wider ${
                active
                  ? "border-[#5a8ff0] bg-gradient-to-b from-[#2f66d6] to-[#2250b8] text-accent before:absolute before:-top-[11px] before:left-1/2 before:h-[3px] before:w-[30px] before:-translate-x-1/2 before:rounded-sm before:bg-accent"
                  : "border-transparent text-muted"
              }`}
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

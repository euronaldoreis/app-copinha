"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { arcade } from "@/lib/labels";
import { CalendarIcon, ChartIcon, HomeIcon, PeopleIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/edicoes", label: "Edições", icon: CalendarIcon },
  { href: "/ranking", label: "Ranking", icon: ChartIcon },
  { href: "/jogadores", label: "Jogadores", icon: PeopleIcon },
];

/** Menu fixo no rodapé, como a barra de um jogo: o item atual fica aceso. */
export function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-night"
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1.5 font-pixel text-[8px] uppercase ${
                active ? "bg-accent text-night" : "text-muted"
              }`}
            >
              <Icon width={22} height={22} />
              {arcade(label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

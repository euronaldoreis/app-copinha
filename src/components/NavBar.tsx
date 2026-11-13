"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChartIcon, HomeIcon, PeopleIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/edicoes", label: "Edições", icon: CalendarIcon },
  { href: "/ranking", label: "Ranking", icon: ChartIcon },
  { href: "/jogadores", label: "Jogadores", icon: PeopleIcon },
];

/** Navegação flutuante: só o item atual mostra o nome, os outros ficam em ícone. */
export function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="glass fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-1.5"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center gap-2 rounded-full px-3.5 text-body ${
              active ? "bg-ink font-semibold text-white" : "text-muted"
            }`}
          >
            <Icon />
            {active && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

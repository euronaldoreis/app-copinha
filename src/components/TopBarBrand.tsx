"use client";

// Lado esquerdo da barra de cima: a marca e, fora das quatro telas do menu, o
// botão de voltar. No app instalado não existe o "voltar" do navegador, então
// ele precisa estar na tela.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronIcon } from "./icons";

/** Telas do menu de baixo: nelas não há para onde voltar. */
const ROOTS = new Set(["/", "/edicoes", "/ranking", "/jogadores"]);

/** Para onde voltar quando a pessoa abriu o site direto numa tela de dentro. */
function parentOf(pathname: string) {
  if (pathname.startsWith("/edicoes/")) return "/edicoes";
  if (pathname.startsWith("/jogadores/")) return "/jogadores";
  return "/";
}

// Caminho percorrido dentro do site nesta visita, para saber se o "voltar" do
// navegador leva a uma tela daqui ou para fora do site.
const TRAIL_KEY = "copinha:caminho";

function readTrail(): string[] {
  try {
    const trail = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "[]");
    return Array.isArray(trail) ? trail : [];
  } catch {
    return [];
  }
}

function recordVisit(pathname: string) {
  const trail = readTrail();
  if (trail.at(-1) === pathname) return; // recarregou a mesma tela
  if (trail.at(-2) === pathname) trail.pop(); // voltou uma tela
  else trail.push(pathname);
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-50)));
  } catch {
    // sem armazenamento: o voltar usa sempre a tela de cima (parentOf)
  }
}

/** Escudo dourado com a lixeira: a marca do torneio. */
export function Emblem({ size = 44 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M24 3 42.2 13.5v21L24 45 5.8 34.5v-21Z" fill="#f7b32b" stroke="#0a1a52" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 7.5 38.3 15.7v16.6L24 40.5 9.7 32.3V15.7Z" fill="#ffd95e" stroke="#ffe9a3" strokeWidth="1.5" strokeLinejoin="round" />
      <g stroke="#5b3600" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M21.5 15.5v-2h5v2" fill="none" />
        <rect x="15.5" y="15.5" width="17" height="3.6" rx="1.4" fill="#fff8dc" />
        <path d="M17.3 19.1h13.4L29.4 33H18.6Z" fill="#fff8dc" />
        <path d="m21.7 22.5.5 7M26.3 22.5l-.5 7" fill="none" />
      </g>
    </svg>
  );
}

export function TopBarBrand() {
  const pathname = usePathname();
  const router = useRouter();
  const inner = !ROOTS.has(pathname);

  useEffect(() => recordVisit(pathname), [pathname]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {inner && (
        <button
          type="button"
          className="btn-hud shrink-0"
          aria-label="Voltar"
          onClick={() => {
            // Veio de outra tela do site: volta para ela, do jeito que estava.
            if (readTrail().length > 1) router.back();
            else router.replace(parentOf(pathname));
          }}
        >
          <ChevronIcon width={22} height={22} className="rotate-180" />
        </button>
      )}
      <Link
        href="/"
        aria-label="Copinha dos Lixos"
        className="flex min-w-0 items-center gap-2"
      >
        <Emblem />
        {/* Nas telas de dentro o voltar ocupa o lugar do nome. */}
        {!inner && (
          <span className="text-title !text-[19px] leading-none text-ink">Copinha</span>
        )}
      </Link>
    </div>
  );
}

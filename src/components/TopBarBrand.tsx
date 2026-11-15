"use client";

// Lado esquerdo da barra de cima: a marca e, fora das quatro telas do menu, o
// botão de voltar. No app instalado não existe o "voltar" do navegador, então
// ele precisa estar na tela.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BallIcon, ChevronIcon, RecycleIcon } from "./icons";

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
          className="btn btn-quiet -ml-2 min-h-10 gap-1 text-ink"
          onClick={() => {
            // Veio de outra tela do site: volta para ela, do jeito que estava.
            if (readTrail().length > 1) router.back();
            else router.replace(parentOf(pathname));
          }}
        >
          <ChevronIcon width={16} height={16} className="rotate-180" />
          Voltar
        </button>
      )}
      <Link
        href="/"
        aria-label="Copinha dos Lixos"
        className="flex min-w-0 items-center gap-2 font-pixel text-[9px] uppercase text-accent"
      >
        <BallIcon width={16} height={16} className="shrink-0 text-ink" />
        <RecycleIcon width={16} height={15} className="shrink-0 text-[#39d36b]" />
        {/* Com o voltar na barra, o nome só cabe em telas mais largas. */}
        <span className={inner ? "hidden truncate sm:inline" : "truncate"}>
          Copinha dos Lixos
        </span>
      </Link>
    </div>
  );
}

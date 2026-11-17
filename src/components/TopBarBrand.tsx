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

/**
 * Brasão do torneio (taça com reciclagem), o mesmo do ícone do app.
 * `size` é a altura; a largura segue a proporção do escudo (147×192).
 */
export function Emblem({ size = 48 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagem pequena e fixa, sem otimização
    <img
      src="/brasao.png"
      alt=""
      width={Math.round((size * 147) / 192)}
      height={size}
      className="shrink-0 drop-shadow-[0_2px_0_rgb(10_26_82_/_0.6)]"
      decoding="async"
    />
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

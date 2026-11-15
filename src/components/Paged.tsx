"use client";

// Paginação de listas. A lista inteira vem pronta do servidor; aqui só se
// escolhe a fatia que aparece. A página atual fica no endereço (?pagina=2),
// então voltar de um jogador ou recarregar cai na mesma página da lista.
import {
  Children,
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChevronIcon } from "./icons";

interface PageState {
  /** Página atual, a partir de 1. */
  page: number;
  pages: number;
  /** Fatia da lista que aparece: de `start` (inclusive) a `end` (exclusive). */
  start: number;
  end: number;
  setPage: (page: number) => void;
  /** Vai no topo da lista: ao trocar de página a tela volta para ele. */
  anchor: RefObject<HTMLDivElement | null>;
}

export function usePage({
  total,
  pageSize,
  param = "pagina",
  initialPage = 1,
}: {
  total: number;
  pageSize: number;
  /** Nome no endereço; listas diferentes na mesma tela usam nomes diferentes. */
  param?: string;
  /** Página mostrada quando o endereço não diz qual. */
  initialPage?: number;
}): PageState {
  const search = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const asked = Number(search.get(param));
  const wanted = Number.isInteger(asked) && asked >= 1 ? asked : initialPage;
  const page = Math.min(Math.max(wanted, 1), pages);
  const anchor = useRef<HTMLDivElement | null>(null);

  const setPage = useCallback(
    (next: number) => {
      const params = new URLSearchParams(window.location.search);
      if (next === initialPage) params.delete(param);
      else params.set(param, String(next));
      const query = params.toString();
      // Troca o endereço sem criar um passo novo no "voltar".
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
      // Se o começo da lista ficou para cima da tela, volta para ele.
      requestAnimationFrame(() => {
        const el = anchor.current;
        if (el && el.getBoundingClientRect().top < 56) {
          el.scrollIntoView({ block: "start" });
        }
      });
    },
    [initialPage, param],
  );

  return {
    page,
    pages,
    start: (page - 1) * pageSize,
    end: page * pageSize,
    setPage,
    anchor,
  };
}

/** Setas de anterior/próxima com "Página 2 de 5" no meio. Some se há uma só. */
export function PageNav({
  page,
  pages,
  onChange,
  label = "Página",
  className = "mt-4",
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  /** O que se pagina, no feminino: "Página", "Rodada". */
  label?: string;
  className?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={`${label}s`}
      className={`flex items-center justify-between gap-3 ${className}`}
    >
      <button
        type="button"
        className="btn btn-icon"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={`${label} anterior`}
      >
        <ChevronIcon className="rotate-180" />
      </button>
      <p className="text-body text-muted" aria-live="polite">
        {label} <span className="num text-name font-semibold text-ink">{page}</span> de{" "}
        <span className="num">{pages}</span>
      </p>
      <button
        type="button"
        className="btn btn-icon"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label={`Próxima ${label.toLowerCase()}`}
      >
        <ChevronIcon />
      </button>
    </nav>
  );
}

/** O que os pedaços de dentro de <Paged> precisam saber (sem a âncora). */
type PagedState = Omit<PageState, "anchor">;

const PagedContext = createContext<PagedState | null>(null);

function usePaged() {
  const state = use(PagedContext);
  if (!state) throw new Error("Use dentro de <Paged>.");
  return state;
}

/**
 * Envolve uma lista paginada montada no servidor:
 *
 *   <Paged total={itens.length} pageSize={10}>
 *     <ul><PageItems>{itens.map(...)}</PageItems></ul>
 *     <PagedNav />
 *   </Paged>
 */
export function Paged({
  total,
  pageSize,
  param,
  initialPage,
  children,
}: {
  total: number;
  pageSize: number;
  param?: string;
  initialPage?: number;
  children: ReactNode;
}) {
  const { anchor, page, pages, start, end, setPage } = usePage({
    total,
    pageSize,
    param,
    initialPage,
  });
  const state = useMemo(
    () => ({ page, pages, start, end, setPage }),
    [page, pages, start, end, setPage],
  );
  return (
    <PagedContext value={state}>
      <div ref={anchor} className="scroll-mt-20">
        {children}
      </div>
    </PagedContext>
  );
}

/** Mostra só os filhos da página atual. */
export function PageItems({ children }: { children: ReactNode }) {
  const { start, end } = usePaged();
  return Children.toArray(children).slice(start, end);
}

export function PagedNav({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { page, pages, setPage } = usePaged();
  return (
    <PageNav
      page={page}
      pages={pages}
      onChange={setPage}
      label={label}
      className={className}
    />
  );
}

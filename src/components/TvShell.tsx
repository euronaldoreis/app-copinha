"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Arcade } from "./Arcade";
import { ExpandIcon } from "./icons";
import { useWakeLock } from "./drawHooks";

/** De quanto em quanto tempo a TV busca os placares lançados no celular. */
const REFRESH_MS = 3000;

/**
 * Moldura das telas de TV: ocupa a tela toda, mantém a tela acesa, busca as
 * novidades sozinha e tem os botões de tela cheia e de sair. O conteúdo vem
 * pronto do servidor.
 */
export function TvShell({
  kicker,
  title,
  exitHref,
  live = true,
  children,
}: {
  kicker: string;
  title: string;
  exitHref: string;
  /** Continua buscando novidades (desliga quando a edição já acabou). */
  live?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);
  useWakeLock();

  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(tick);
  }, [router, live]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="choice-tv fixed inset-0 z-50 overflow-y-auto">
      <div className="choice-tv-inner">
        <header className="choice-tv-head">
          <div className="flex min-w-0 items-center gap-[1.2vw]">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem pequena e fixa, sem otimização */}
            <img src="/brasao.png" alt="" className="choice-tv-emblem" />
            <div className="min-w-0">
              <p className="choice-tv-kicker">
                {live && <span className="edition-tv-dot" aria-hidden="true" />}
                {kicker}
              </p>
              <h1 className="choice-tv-title text-title" aria-label={title}>
                <Arcade>{title}</Arcade>
              </h1>
            </div>
          </div>
          {!fullscreen && (
            <div className="choice-tv-tools">
              <button
                type="button"
                className="btn-hud"
                onClick={toggleFullscreen}
                aria-label="Tela cheia"
                title="Tela cheia"
              >
                <ExpandIcon width={20} height={20} />
              </button>
              <Link href={exitHref} className="btn-hud" aria-label="Sair" title="Sair">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

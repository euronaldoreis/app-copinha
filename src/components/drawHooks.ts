"use client";

import { useCallback, useEffect, useState } from "react";

/** Tela cheia do navegador: `active` acompanha também a saída pela tecla Esc. */
export function useFullscreen() {
  // O sorteio só aparece depois de um clique, já no navegador: dá para ler direto.
  const [active, setActive] = useState(() => document.fullscreenElement != null);
  const [supported] = useState(() => Boolean(document.documentElement.requestFullscreen));

  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  return { active, supported, toggle };
}

/** Mantém a tela da TV acesa enquanto o sorteio está aberto (quando o navegador permite). */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let closed = false;
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
        if (closed) void lock?.release();
      } catch {
        // sem suporte ou negado: segue sem
      }
    };
    void acquire();
    const again = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", again);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", again);
      void lock?.release();
    };
  }, []);
}

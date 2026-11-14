"use client";

// Peças do estádio em pixel art, usadas no sorteio dos grupos e na festa do
// campeão: a moldura (arquibancada, placas e a entrada dos jogadores) e o
// jogador que entra andando. A entrada pode ser o túnel ou o caminhão de lixo
// parado na beira do campo. O visual fica em globals.css.
import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { GarbageTruck, TRUCK_GRID, TRUCK_HATCH } from "./GarbageTruck";

/** Duração da caminhada do túnel até o lugar no gramado. */
export const WALK_MS = 1500;

export const prefersCalm = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type TunnelRef = RefObject<HTMLDivElement | null>;

/**
 * Arquibancada, placas e a entrada dos jogadores em volta do gramado
 * (`children`). Quem usa cria o `tunnel` com useRef e passa o mesmo para os
 * <Walker>: ele marca de onde os jogadores saem (boca do túnel ou traseira do
 * caminhão).
 */
export function Stadium({
  tunnel,
  entrance = "tunnel",
  party = false,
  children,
}: {
  tunnel: TunnelRef;
  entrance?: "tunnel" | "truck";
  /** Torcida em festa: pula mais rápido. */
  party?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="stadium relative">
      <div className={`stands ${party ? "stands-party" : ""}`} />
      <div className="adboard" aria-hidden="true">
        <span>Copinha dos Lixos</span>
        <span>Copinha dos Lixos</span>
        <span className="hidden sm:inline">Copinha dos Lixos</span>
      </div>
      {children}
      {/* A faixa de baixo fica por cima do gramado: quem ainda não entrou
          está escondido atrás dela. */}
      {entrance === "truck" ? (
        <div className="street">
          <div className="truck-drive">
            <div className="truck-idle">
              <GarbageTruck />
              {/* Boca do compactor: é dali que os jogadores pulam para fora. */}
              <div
                ref={tunnel}
                className="absolute inset-y-0"
                style={{
                  left: `${(TRUCK_HATCH.x / TRUCK_GRID.width) * 100}%`,
                  width: `${(TRUCK_HATCH.width / TRUCK_GRID.width) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="tunnel-wall">
          <div ref={tunnel} className="tunnel-mouth" />
        </div>
      )}
    </div>
  );
}

/**
 * Quem está aqui dentro entra em campo andando. O elemento já nasce no lugar
 * final; ao aparecer, a animação o traz de dentro do túnel: sobe reto até
 * pisar no gramado (saindo pela boca do túnel) e depois vai até o lugar.
 */
export function Walker({
  walk,
  tunnel,
  className,
  children,
}: {
  /** Falso para aparecer já no lugar (animação pulada). */
  walk: boolean;
  tunnel: TunnelRef;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Só na entrada: `walk` vale no momento em que o jogador aparece.
  useLayoutEffect(() => {
    const el = ref.current;
    const door = tunnel.current;
    if (!el || !door || !walk || prefersCalm()) return;
    const me = el.getBoundingClientRect();
    const from = door.getBoundingClientRect();
    // Cena ampliada (modo TV): a medida na tela é maior que a do layout.
    const k = el.offsetWidth && me.width ? el.offsetWidth / me.width : 1;
    const dx = (from.left + from.width / 2 - (me.left + me.width / 2)) * k;
    const hidden = (from.top + 6 * (1 / k) - me.top) * k; // escondido atrás do muro
    const onPitch = (from.top - me.height - 6 * (1 / k) - me.top) * k; // recém-saído do túnel
    const climb = hidden - onPitch;
    const cross = Math.hypot(dx, onPitch);
    el.classList.add("walking");
    const animation = el.animate(
      [
        { transform: `translate(${dx}px, ${hidden}px)` },
        {
          transform: `translate(${dx}px, ${onPitch}px)`,
          offset: climb / (climb + cross),
        },
        { transform: "none" },
      ],
      { duration: WALK_MS, easing: "steps(20, end)" },
    );
    animation.onfinish = () => el.classList.remove("walking");
    return () => {
      animation.cancel();
      el.classList.remove("walking");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

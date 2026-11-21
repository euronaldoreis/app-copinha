"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Tier } from "@/lib/tier";

type Box = { left: number; top: number; width: number; height: number };

/** Transformação da carta: deslocamento, tamanho e giro. */
const pose = (x: number, y: number, scale: number, turnY: number, tilt: number) =>
  `translate(${x}px, ${y}px) scale(${scale}) perspective(900px) rotateY(${turnY}deg) rotateZ(${tilt}deg)`;

/**
 * A carta do jogador no perfil. Ao tocar, ela salta, gira e para no meio da
 * tela mostrando o verso (`back`). Tocar de novo, no fundo ou Esc a devolve.
 */
export function ProfileCard({
  tier,
  label,
  children,
  back,
}: {
  tier: Tier;
  /** Descrição do verso, para quem usa leitor de tela. */
  label: string;
  children: ReactNode;
  back: ReactNode;
}) {
  const origin = useRef<HTMLButtonElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [arrived, setArrived] = useState(false);
  const closing = useRef(false);
  const atCenter = useRef(false);

  const open = () => {
    const r = origin.current?.getBoundingClientRect();
    if (!r) return;
    closing.current = false;
    setArrived(false);
    setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
  };

  /** Onde a carta começa (no perfil) em relação ao centro da tela, e o zoom final. */
  const geometry = (b: Box) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(2.2, (vw - 56) / b.width, (vh * 0.64) / b.height);
    return {
      dx: b.left - (vw - b.width) / 2,
      dy: b.top - (vh - b.height) / 2,
      scale,
    };
  };

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (!box || !flip.current) return;
    const { dx, dy, scale } = geometry(box);
    const end = pose(0, 0, scale, 540, 0);
    const anim = reduced()
      ? flip.current.animate(
          [
            { transform: end, opacity: 0 },
            { transform: end, opacity: 1 },
          ],
          { duration: 200, fill: "forwards" },
        )
      : flip.current.animate(
          [
            { transform: pose(dx, dy, 1, 0, 0), easing: "ease-out" },
            // salta e balança antes de sair
            { offset: 0.14, transform: pose(dx, dy - 16, 1.08, 0, -6), easing: "ease-in-out" },
            { offset: 0.26, transform: pose(dx, dy - 16, 1.08, 0, 5), easing: "cubic-bezier(.25,.8,.25,1)" },
            { transform: end },
          ],
          { duration: 1150, fill: "forwards" },
        );
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 350,
      fill: "forwards",
    });
    anim.onfinish = () => {
      if (closing.current) return;
      atCenter.current = true;
      setArrived(true);
      closeBtn.current?.focus({ preventScroll: true });
    };
    return () => anim.cancel();
  }, [box]);

  const close = () => {
    if (!box || closing.current) return;
    closing.current = true;
    setArrived(false);
    const el = flip.current;
    if (!el) return setBox(null);
    const { dx, dy, scale } = geometry(box);
    // de onde estiver agora (mesmo no meio da ida) de volta para o perfil
    const from = atCenter.current ? pose(0, 0, scale, 540, 0) : getComputedStyle(el).transform;
    atCenter.current = false;
    el.getAnimations().forEach((a) => a.cancel());
    const done = () => {
      setBox(null);
      origin.current?.focus({ preventScroll: true });
    };
    if (reduced()) return done();
    const anim = el.animate(
      [
        { transform: from },
        { transform: pose(dx, dy, 1, 720, 0) },
      ],
      { duration: 650, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" },
    );
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 650,
      fill: "forwards",
    });
    anim.onfinish = done;
  };

  useEffect(() => {
    if (!box) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      // só há um botão no modal: o foco não sai dele
      if (e.key === "Tab") {
        e.preventDefault();
        closeBtn.current?.focus();
      }
    };
    // girar o celular ou redimensionar: fecha sem animação, para não ficar torta
    const onResize = () => setBox(null);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = overflow;
    };
    // close só lê refs e o box atual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  const face = `player-card profile-card tier-${tier}`;

  return (
    <>
      <button
        ref={origin}
        type="button"
        className={`profile-card-origin ${box ? "invisible" : ""}`}
        aria-label="Virar a carta"
        aria-haspopup="dialog"
        onClick={open}
      >
        <span className={face}>{children}</span>
      </button>

      {box &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`card-stage card-stage-${tier} ${arrived ? "is-arrived" : ""}`}
          >
            <div ref={backdrop} className="card-stage-backdrop" onClick={close} />
            <div className="card-stage-rays" aria-hidden="true" />
            <div
              ref={flip}
              className="card-flip"
              style={{
                width: box.width,
                height: box.height,
                left: `calc(50% - ${box.width / 2}px)`,
                top: `calc(50% - ${box.height / 2}px)`,
                transform: pose(geometry(box).dx, geometry(box).dy, 1, 0, 0),
              }}
              onClick={close}
            >
              <div className={`${face} card-face`} aria-hidden="true">
                {children}
              </div>
              <div className={`player-card tier-${tier} card-face card-back`}>{back}</div>
            </div>
            <p className="card-stage-hint" aria-hidden="true">
              Toque para fechar
            </p>
            <button ref={closeBtn} type="button" className="sr-only" onClick={close}>
              Fechar
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import "@fontsource/silkscreen/latin-400.css";
import "@fontsource/silkscreen/latin-700.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GroupDrawItem } from "@/lib/services";
import type { BoardState, DrawScene } from "./draw3d/stadiumScene";
import { useFullscreen, useWakeLock } from "./drawHooks";
import { ExpandIcon } from "./icons";

/** O aparelho consegue desenhar a cena 3D? Se não, a tela usa o sorteio em 2D. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type IntroStage = "on" | "crane" | "off";

/** Placar do sorteio: roleta do nome, depois da letra do grupo. */
function Board({ state, hidden }: { state: BoardState | null; hidden: boolean }) {
  const s = state;
  return (
    <div className={`d3-board ${hidden ? "is-hidden" : ""}`} aria-live="polite">
      <div className="d3-head">
        <span>Sorteio dos grupos</span>
        <span>{s ? `${Math.min(s.placed + 1, s.total)}/${s.total}` : ""}</span>
      </div>
      {s?.done ? (
        <div className="d3-done">
          <b>Grupos definidos</b>
          <small>A tabela de jogos já está pronta.</small>
        </div>
      ) : (
        <div className="d3-row">
          <div className="min-w-0">
            <div
              // a chave reinicia a animação quando o nome para
              key={s?.phase === "name" ? "spin" : `n-${s?.placed}`}
              className={`d3-name ${s?.phase === "name" ? "is-spin" : "d3-reveal"}`}
              aria-hidden={s?.phase === "name"}
            >
              {s?.name || " "}
            </div>
            <div className="d3-team">{s?.phase === "name" || !s ? "Sorteando..." : s.team}</div>
            {s && s.phase !== "name" && s.champion && <div className="d3-champ">🏆 Atual campeão</div>}
          </div>
          <div className="d3-gbox">
            <span>Grupo</span>
            <div
              key={s?.phase === "show" ? `l-${s.placed}` : "spin"}
              className={`d3-letter ${s?.phase === "show" ? "d3-reveal" : "is-spin"} ${
                !s || s.phase === "name" ? "is-blink" : ""
              }`}
            >
              {s?.letter ?? "?"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sorteio dos grupos em 3D: o caminhão de lixo chega à arena, a câmera revela o
 * estádio e cada sorteado salta do caminhão, passa pelo corredor da torcida e
 * vai para o grupo dele. O campeão da edição anterior entra com o troféu.
 */
export function GroupDraw3D({
  draw,
  closing,
  onClose,
  onFail,
}: {
  draw: GroupDrawItem[];
  closing: boolean;
  onClose: () => void;
  /** A cena não pôde ser montada: quem chama mostra o sorteio em 2D. */
  onFail: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const scene = useRef<DrawScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<BoardState | null>(null);
  const [intro, setIntro] = useState<IntroStage>("off");
  const [done, setDone] = useState(false);
  const [idle, setIdle] = useState(false);
  const fullscreen = useFullscreen();
  const { toggle: toggleFullscreen } = fullscreen;
  useWakeLock();

  // A lista só muda se o sorteio for refeito; a cena é montada uma vez por sorteio.
  const items = useRef(draw);
  const fail = useRef(onFail);
  useEffect(() => {
    fail.current = onFail;
  }, [onFail]);

  useEffect(() => {
    let cancelled = false;
    let created: DrawScene | null = null;
    // three.js só é baixado quando o sorteio abre.
    import("./draw3d/stadiumScene")
      .then(({ createDrawScene }) => {
        if (cancelled || !stage.current || !tags.current) return;
        created = createDrawScene({
          container: stage.current,
          tagsLayer: tags.current,
          items: items.current,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          insets: () => ({
            top: (board.current?.getBoundingClientRect().bottom ?? 0) + 6,
            bottom: window.innerHeight - (bar.current?.getBoundingClientRect().top ?? window.innerHeight) + 6,
          }),
          onBoard: setState,
          onIntro: (active, fading) => setIntro(active ? "on" : fading ? "crane" : "off"),
          onDone: () => setDone(true),
        });
        scene.current = created;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) fail.current();
      });
    return () => {
      cancelled = true;
      created?.dispose();
      scene.current = null;
    };
  }, []);

  // Em tela cheia, o cursor some quando o mouse fica parado; a tecla F alterna.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2500);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
    };
  }, [toggleFullscreen]);

  // Vai direto no <body>: um ancestral com transform/animação prenderia o
  // position: fixed dentro dele em vez de cobrir a tela.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sorteio dos grupos"
      className={`draw3d fixed inset-0 z-50 overflow-hidden ${fullscreen.active && idle ? "cursor-none" : ""}`}
    >
      <div ref={stage} className="absolute inset-0" />
      <div ref={tags} aria-hidden="true" />
      <div ref={board} className="d3-board-wrap">
        <Board state={state} hidden={loading || intro !== "off"} />
      </div>
      <div className={`d3-intro ${intro === "on" && !loading ? "is-on" : ""}`} aria-hidden={intro !== "on"}>
        <div className="d3-live">
          <i />
          AO VIVO
        </div>
        <b>Copinha dos Lixos</b>
        <small>Sorteio dos grupos</small>
      </div>
      <div ref={bar} className="d3-bar">
        {done ? (
          <button type="button" className="d3-btn is-primary" onClick={onClose} disabled={closing} autoFocus>
            {closing ? "Abrindo..." : "Ver tabela de jogos"}
          </button>
        ) : (
          <button type="button" className="d3-btn" onClick={() => scene.current?.skip()} disabled={loading}>
            Pular animação
          </button>
        )}
        {fullscreen.supported && (
          <button
            type="button"
            className="d3-btn"
            onClick={fullscreen.toggle}
            title="Tela cheia (tecla F)"
            aria-label={fullscreen.active ? "Sair da tela cheia" : "Tela cheia"}
          >
            <ExpandIcon />
          </button>
        )}
      </div>
      {loading && <div className="d3-loading">Montando o estádio…</div>}
    </div>,
    document.body,
  );
}

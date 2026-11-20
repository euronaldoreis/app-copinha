"use client";

import "@fontsource/silkscreen/latin-400.css";
import "@fontsource/silkscreen/latin-700.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isMuted, setMuted, sfx, stopAudio, unlockAudio } from "@/lib/sfx";
import { buildShareCard, shareCard } from "@/lib/shareCard";
import type { PartyPerson } from "./ChampionParty";
import type { DrawScene, PartyStage, SceneItem } from "./draw3d/stadiumScene";
import { useFullscreen, useWakeLock } from "./drawHooks";
import { ExpandIcon, TrophyIcon } from "./icons";
import { PlayerSprite } from "./PlayerSprite";

const toItem = (p: PartyPerson, place: 1 | 2 | 3): SceneItem => ({
  entryId: p.entryId,
  playerName: p.name,
  avatar: p.avatar,
  teamName: p.team,
  groupLabel: null,
  champion: place === 1,
  place,
});

/**
 * Festa do título em 3D: o caminhão chega à arena, o 3º lugar e o vice sobem
 * no pódio, rufam os tambores e o campeão entra para levantar a taça, com
 * fogos, papel picado e jatos de fogo.
 */
export function ChampionParty3D({
  editionName,
  champion,
  vice,
  third,
  onClose,
  onFail,
}: {
  editionName: string;
  champion: PartyPerson;
  vice: PartyPerson | null;
  third: PartyPerson | null;
  onClose: () => void;
  /** A cena não pôde ser montada: quem chama mostra a festa em 2D. */
  onFail: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const sprites = useRef<HTMLDivElement>(null);
  const scene = useRef<DrawScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [intro, setIntro] = useState<"on" | "crane" | "off">("off");
  const [step, setStep] = useState<PartyStage | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [card, setCard] = useState<File | null>(null);
  const fullscreen = useFullscreen();
  useWakeLock();

  // Montada uma vez por festa.
  const people = useRef({ champion, vice, third });
  const fail = useRef(onFail);
  useEffect(() => {
    fail.current = onFail;
  }, [onFail]);

  useEffect(() => {
    let cancelled = false;
    let created: DrawScene | null = null;
    const { champion: c, vice: v, third: t } = people.current;
    const items = [toItem(c, 1), ...(v ? [toItem(v, 2)] : []), ...(t ? [toItem(t, 3)] : [])];
    import("./draw3d/stadiumScene")
      .then(({ createDrawScene }) => {
        if (cancelled || !stage.current || !tags.current) return;
        created = createDrawScene({
          mode: "party",
          container: stage.current,
          tagsLayer: tags.current,
          items,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          insets: () => ({
            top: (board.current?.getBoundingClientRect().bottom ?? 0) + 6,
            bottom: window.innerHeight - (bar.current?.getBoundingClientRect().top ?? window.innerHeight) + 6,
          }),
          onIntro: (active, fading) => {
            setIntro(active ? "on" : fading ? "crane" : "off");
            if (active) sfx.truck();
          },
          onStage: (s) => {
            setStep(s);
            // Trilha de cada etapa.
            if (s === "third") sfx.podium(3, 2.8);
            else if (s === "vice") sfx.podium(2, 2.8);
            else if (s === "drumroll") sfx.drumroll(2.1);
            else if (s === "champion") sfx.champion();
            else {
              sfx.fanfare();
              navigator.vibrate?.([90, 50, 90, 50, 220]);
            }
          },
          onDone: () => {},
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
      stopAudio();
    };
  }, []);

  const party = step === "party";

  // Imagem do pódio para compartilhar, montada quando a festa começa (o
  // compartilhamento do celular só abre se ela já estiver pronta no toque).
  useEffect(() => {
    if (!party || card) return;
    let alive = true;
    const svg = (selector: string) =>
      sprites.current?.querySelector<SVGSVGElement>(`${selector} svg`) ?? null;
    const person = (p: PartyPerson | null, place: number) =>
      p && { name: p.name, team: p.team, sprite: svg(`[data-place="${place}"]`) };
    buildShareCard({
      editionName,
      champion: person(champion, 1)!,
      vice: person(vice, 2),
      third: person(third, 3),
      trophy: svg("[data-trophy]"),
    })
      .then((file) => {
        if (alive) setCard(file);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [party, card, editionName, champion, vice, third]);

  const text: Record<PartyStage, { tag: string; name: string; sub: string }> = {
    third: { tag: "Terceiro lugar", name: third?.name ?? "", sub: third?.team ?? "" },
    vice: { tag: "Vice-campeão", name: vice?.name ?? "", sub: vice?.team ?? "" },
    drumroll: { tag: "E o campeão é...", name: "? ? ?", sub: "" },
    champion: { tag: "Campeão!", name: champion.name, sub: champion.team ?? "" },
    party: { tag: "Campeão!", name: champion.name, sub: champion.team ?? "" },
  };
  const shown = step ? text[step] : { tag: "Hora da festa", name: editionName, sub: "Os melhores entram em campo" };
  const big = step === "champion" || party;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Festa do campeão"
      className="draw3d fixed inset-0 z-50 overflow-hidden"
    >
      <div ref={stage} className="absolute inset-0" />
      <div ref={tags} aria-hidden="true" />
      <div ref={board} className="d3-board-wrap">
        <div className={`d3-board ${loading || intro !== "off" ? "is-hidden" : ""}`} aria-live="polite">
          <div className="d3-head">
            <span>Premiação</span>
            <span className="truncate pl-3">{editionName}</span>
          </div>
          <div className="d3-party">
            <div key={`t-${big ? "c" : step}`} className={`d3-party-tag ${step === "drumroll" || big ? "is-blink" : ""}`}>
              {shown.tag}
            </div>
            <div key={`n-${big ? "c" : step}`} className={`d3-party-name d3-reveal ${big ? "is-gold" : ""}`}>
              {shown.name}
            </div>
            <div className="d3-team">{shown.sub || " "}</div>
          </div>
        </div>
      </div>
      <div className={`d3-intro ${intro === "on" && !loading ? "is-on" : ""}`} aria-hidden={intro !== "on"}>
        <div className="d3-live">
          <i />
          AO VIVO
        </div>
        <b>Festa do título</b>
        <small>{editionName}</small>
      </div>
      <div ref={bar} className="d3-bar">
        {party ? (
          <>
            {card && (
              <button
                type="button"
                className="d3-btn"
                onClick={() => shareCard(card, `${champion.name} é o campeão da ${editionName}!`)}
              >
                Compartilhar
              </button>
            )}
            <button
              type="button"
              className="d3-btn"
              onClick={() => {
                unlockAudio();
                setStep(null);
                scene.current?.replay();
              }}
            >
              Rever
            </button>
            <button type="button" className="d3-btn is-primary" onClick={onClose} autoFocus>
              Fechar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="d3-btn"
            disabled={loading}
            onClick={() => {
              unlockAudio();
              scene.current?.skip();
            }}
          >
            Pular
          </button>
        )}
        <button
          type="button"
          className="d3-btn"
          aria-pressed={!muted}
          title={muted ? "Ligar o som" : "Desligar o som"}
          onClick={() => {
            unlockAudio();
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? "Som off" : "Som on"}
        </button>
        {fullscreen.supported && (
          <button
            type="button"
            className="d3-btn"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.active ? "Sair da tela cheia" : "Tela cheia"}
          >
            <ExpandIcon />
          </button>
        )}
      </div>
      {/* Desenhos usados só na imagem para compartilhar. */}
      <div ref={sprites} aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0">
        <div data-place="1">
          <PlayerSprite name={champion.name} avatar={champion.avatar} width={48} />
        </div>
        {vice && (
          <div data-place="2">
            <PlayerSprite name={vice.name} avatar={vice.avatar} width={36} />
          </div>
        )}
        {third && (
          <div data-place="3">
            <PlayerSprite name={third.name} avatar={third.avatar} width={36} />
          </div>
        )}
        <div data-trophy>
          <TrophyIcon width={30} height={30} className="text-accent" />
        </div>
      </div>
      {loading && <div className="d3-loading">Preparando a festa…</div>}
    </div>,
    document.body,
  );
}

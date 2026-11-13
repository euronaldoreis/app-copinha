"use client";

import { useEffect, useRef, useState } from "react";
import { arcade } from "@/lib/labels";
import { PlayerSprite } from "./PlayerSprite";
import { TrophyIcon } from "./icons";
import { Stadium, Walker, prefersCalm, type TunnelRef } from "./stadium";

export interface PartyPerson {
  entryId: number;
  name: string;
  team: string | null;
}

/** Evento que o botão "Rever a festa" dispara para reabrir a cerimônia. */
const REPLAY_EVENT = "copinha:festa";

type Stage = "intro" | "third" | "vice" | "drumroll" | "champion" | "party";

// Quanto tempo cada etapa da cerimônia fica na tela ("party" é a última e fica).
const STAGE_MS: Record<Stage, number> = {
  intro: 1600, // dá tempo do caminhão chegar antes de alguém descer
  third: 2000,
  vice: 2000,
  drumroll: 1800,
  champion: 1900,
  party: 0,
};

const CONFETTI_COLORS = ["#ffd42a", "#f6f6fa", "#e23b2e", "#2f6fe0", "#19b5c9"];
// Papel picado: posição, atraso e velocidade variam com o índice (sem sorteio,
// para o desenho ser sempre o mesmo).
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 17) % 24) / 10}s`,
  duration: `${2.2 + (i % 5) * 0.35}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

/** Um degrau do pódio, com quem sobe nele. */
function PodiumStep({
  person,
  place,
  present,
  walk,
  tunnel,
  celebrating = false,
}: {
  person: PartyPerson;
  place: 1 | 2 | 3;
  present: boolean;
  walk: boolean;
  tunnel: TunnelRef;
  celebrating?: boolean;
}) {
  const champion = place === 1;
  return (
    <div className="flex w-[31%] max-w-36 flex-col items-center">
      {/* Espaço reservado para o jogador (e a taça), para nada pular de lugar. */}
      <div
        className="flex items-end justify-center"
        style={{ height: champion ? 100 : 52 }}
      >
        {present && (
          <Walker walk={walk} tunnel={tunnel}>
            <div
              className={`flex flex-col items-center ${celebrating ? "jumping" : ""}`}
            >
              {champion && (
                <TrophyIcon
                  width={30}
                  height={30}
                  className={`text-accent ${celebrating ? "animate-reveal" : "invisible"}`}
                />
              )}
              <PlayerSprite name={person.name} width={champion ? 48 : 36} />
            </div>
          </Walker>
        )}
      </div>
      <div className={`podium-block podium-${place}`}>{place}</div>
      <span className="field-name mt-1.5 w-full truncate text-center">
        {present ? person.name : " "}
      </span>
    </div>
  );
}

function PartyOverlay({
  editionName,
  champion,
  vice,
  third,
  onClose,
}: {
  editionName: string;
  champion: PartyPerson;
  vice: PartyPerson | null;
  third: PartyPerson | null;
  onClose: () => void;
}) {
  // Ordem de cerimônia: 3º lugar, vice e, por último, o campeão.
  const stages: Stage[] = [
    "intro",
    ...(third ? (["third"] as const) : []),
    ...(vice ? (["vice"] as const) : []),
    "drumroll",
    "champion",
    "party",
  ];
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const tunnel = useRef<HTMLDivElement>(null);
  const stage = stages[step];
  const reached = (s: Stage) => stages.indexOf(s) !== -1 && step >= stages.indexOf(s);
  const party = stage === "party";

  useEffect(() => {
    if (party) return;
    const ms = prefersCalm() ? 700 : STAGE_MS[stage];
    const next = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(next);
  }, [stage, party]);

  // O que o placar anuncia em cada etapa.
  const board: Record<Stage, { tag: string; name: string; sub: string }> = {
    intro: { tag: "Hora da festa", name: editionName, sub: "Os melhores entram em campo" },
    third: { tag: "Terceiro lugar", name: third?.name ?? "", sub: third?.team ?? "" },
    vice: { tag: "Vice-campeão", name: vice?.name ?? "", sub: vice?.team ?? "" },
    drumroll: { tag: "E o campeão é...", name: "? ? ?", sub: "" },
    champion: { tag: "Campeão!", name: champion.name, sub: champion.team ?? "" },
    party: { tag: "Campeão!", name: champion.name, sub: champion.team ?? "" },
  };
  const { tag, name, sub } = board[stage];
  const big = stage === "champion" || party;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Festa do campeão"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-6">
        <div className="scoreboard" aria-live="polite">
          <div className="flex items-center justify-between gap-3 font-pixel text-[8px] uppercase text-accent">
            <span>{arcade("Premiação")}</span>
            <span className="truncate">{arcade(editionName)}</span>
          </div>
          <div className="flex min-h-[104px] flex-col items-center justify-center gap-2 text-center">
            <p
              className={`font-pixel text-[10px] uppercase text-accent ${
                stage === "drumroll" || big ? "blink" : ""
              }`}
            >
              {arcade(tag)}
            </p>
            <p
              key={stage === "party" ? "champion" : stage}
              className={`animate-reveal w-full truncate text-title ${big ? "text-accent" : ""}`}
            >
              {arcade(name)}
            </p>
            <p className="min-h-[23px] text-body text-muted">{sub}</p>
          </div>
        </div>

        <Stadium tunnel={tunnel} entrance="truck" party={party}>
          <div className="turf relative z-10 flex min-h-[230px] items-end justify-center gap-2 px-3 pb-4 pt-6">
            {vice && (
              <PodiumStep
                person={vice}
                place={2}
                present={reached("vice")}
                walk={!skipped}
                tunnel={tunnel}
              />
            )}
            <PodiumStep
              person={champion}
              place={1}
              present={reached("champion")}
              walk={!skipped}
              tunnel={tunnel}
              celebrating={party}
            />
            {third && (
              <PodiumStep
                person={third}
                place={3}
                present={reached("third")}
                walk={!skipped}
                tunnel={tunnel}
              />
            )}
          </div>
          {party && (
            <div className="confetti-layer" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="confetti"
                  style={{
                    left: c.left,
                    background: c.color,
                    animationDelay: c.delay,
                    animationDuration: c.duration,
                  }}
                />
              ))}
            </div>
          )}
        </Stadium>

        <div className="flex justify-center pb-4">
          {party ? (
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
              Fechar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setSkipped(true);
                setStep(stages.length - 1);
              }}
            >
              Pular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Festa do campeão. Fica sempre montada na página da edição: abre sozinha no
 * instante em que a edição ganha um campeão (o admin acabou de lançar a final)
 * e pode ser reaberta por qualquer pessoa pelo <PartyButton>.
 */
export function ChampionParty({
  editionName,
  champion,
  vice,
  third,
  auto,
}: {
  editionName: string;
  champion: PartyPerson | null;
  vice: PartyPerson | null;
  third: PartyPerson | null;
  /** Abrir sozinha quando o campeão surgir (só para quem lança os placares). */
  auto: boolean;
}) {
  const championId = champion?.entryId ?? null;
  // Compara com o campeão do render anterior para notar o momento da conquista.
  const [seenId, setSeenId] = useState(championId);
  const [open, setOpen] = useState(false);
  if (championId !== seenId) {
    setSeenId(championId);
    if (championId != null && auto) setOpen(true);
  }

  useEffect(() => {
    const replay = () => setOpen(true);
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  if (!open || !champion) return null;
  return (
    <PartyOverlay
      editionName={editionName}
      champion={champion}
      vice={vice}
      third={third}
      onClose={() => setOpen(false)}
    />
  );
}

export function PartyButton() {
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}
    >
      <TrophyIcon width={18} height={18} />
      Rever a festa
    </button>
  );
}

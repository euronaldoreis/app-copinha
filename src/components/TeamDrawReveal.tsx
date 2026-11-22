"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { Arcade } from "./Arcade";
import { Avatar } from "./Avatar";
import { TeamShield } from "./TeamShield";
import type { ChoicePlayer } from "./TeamChoiceAdmin";

/** Tempos de cada etapa da revelação de um sorteio (ms). */
export const REVEAL_STEPS = { player: 1300, spin: 3400, reveal: 2000 };

type Stage = "player" | "spin" | "reveal";

/**
 * Intervalos da roleta: começa rápida e vai freando até parar. Devolve os
 * atrasos entre um escudo e o próximo, somando cerca de `total` ms.
 */
function spinDelays(total: number) {
  const delays: number[] = [];
  let d = 55;
  let sum = 0;
  while (sum + d < total) {
    delays.push(d);
    sum += d;
    d *= 1.12;
  }
  return delays;
}

/**
 * Revelação de um sorteio na TV: aparece o jogador, a roleta gira pelos times
 * que ainda estão na urna e para no time sorteado. Chama `onDone` no fim.
 */
export function TeamDrawReveal({
  player,
  team,
  candidates,
  number,
  total,
  countLabel,
  onDone,
}: {
  player: ChoicePlayer;
  team: string;
  /** Times que ainda estavam na urna (inclui o sorteado). */
  candidates: string[];
  number: number;
  total: number;
  /** Texto no lugar de "Sorteio N de M" (ex.: um sorteio avulso). */
  countLabel?: string;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("player");
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const target = Math.max(0, candidates.indexOf(team));
    const { player: p, spin: s, reveal: r } = REVEAL_STEPS;

    if (calm || candidates.length < 2) {
      at(p, () => {
        setStage("reveal");
        sfx.champion();
      });
      at(p + r, onDone);
    } else {
      at(p, () => {
        setStage("spin");
        sfx.drumroll(s / 1000);
      });
      // a roleta termina exatamente no time sorteado
      const delays = spinDelays(s);
      const m = candidates.length;
      const start = (((target - delays.length) % m) + m) % m;
      let t = p;
      delays.forEach((d, k) => {
        t += d;
        at(t, () => setSpin((start + k + 1) % m));
      });
      at(p + s, () => {
        setSpin(target);
        setStage("reveal");
        sfx.champion();
      });
      at(p + s + r, onDone);
    }
    return () => timers.forEach(clearTimeout);
    // a revelação é montada uma vez por sorteio (key no pai)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = stage === "reveal" ? team : stage === "spin" ? candidates[spin] : null;

  return (
    <div
      className={`draw-reveal is-${stage}`}
      role="status"
      aria-live="assertive"
      aria-label={stage === "reveal" ? `${player.name} vai jogar de ${team}` : `Sorteando o time de ${player.name}`}
    >
      <div className="draw-reveal-rays" aria-hidden="true" />
      <div className="draw-reveal-body">
        <p className="draw-reveal-count num">
          {countLabel ?? `Sorteio ${number} de ${total}`}
        </p>
        <div className="draw-reveal-player anim-pop">
          <Avatar name={player.name} photoUrl={player.photoUrl} avatar={player.avatar} size={120} />
          <span className="text-title">
            <Arcade>{player.name}</Arcade>
          </span>
        </div>
        <p className="draw-reveal-says">vai jogar de...</p>
        <div className="draw-reveal-shield" aria-hidden="true">
          {shown ? (
            <span key={stage === "reveal" ? "fim" : spin} className={stage === "reveal" ? "is-final" : ""}>
              <TeamShield team={shown} size={200} />
            </span>
          ) : (
            <span className="is-mystery">
              <TeamShield team={null} size={200} />
            </span>
          )}
        </div>
        <p className="draw-reveal-team">
          {shown && (
            <span key={stage === "reveal" ? "fim" : spin}>
              <Arcade>{shown}</Arcade>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

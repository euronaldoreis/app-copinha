"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  PICKS_PER_PLAYER,
  choiceState,
  foldTeam,
  type ChoiceRow,
} from "@/lib/teamChoice";
import { Arcade } from "./Arcade";
import { Avatar } from "./Avatar";
import { ExpandIcon } from "./icons";
import { TeamShield } from "./TeamShield";
import { ChoiceSteps } from "./TeamChoiceSteps";
import type { ChoicePlayer } from "./TeamChoiceAdmin";
import { useWakeLock } from "./drawHooks";

/** De quanto em quanto tempo a TV busca as novidades lançadas no celular. */
const REFRESH_MS = 2000;

/** Colunas da grade, para caber todo mundo numa tela de TV (até 2 fileiras). */
const columns = (n: number) =>
  n <= 4 ? Math.max(n, 2) : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6;

/**
 * Escolha dos times projetada na TV: só mostra. O administrador lança tudo pelo
 * celular e esta tela se atualiza sozinha a cada poucos segundos.
 */
export function TeamChoiceTv({
  editionId,
  editionName,
  players,
  choices,
}: {
  editionId: number;
  editionName: string;
  players: ChoicePlayer[];
  choices: ChoiceRow[];
}) {
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);
  useWakeLock();

  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(tick);
  }, [router]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const state = useMemo(
    () => choiceState(players.map((p) => p.id), choices),
    [players, choices],
  );
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "";
  const last = [...state.picks, ...state.bans].sort((a, b) => b.id - a.id)[0];

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
              <p className="choice-tv-kicker">Escolha dos times</p>
              <h1 className="choice-tv-title text-title" aria-label={editionName}>
                <Arcade>{editionName}</Arcade>
              </h1>
            </div>
          </div>
          <div className="choice-tv-tools">
            {!fullscreen && (
              <button type="button" className="btn-hud" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia">
                <ExpandIcon width={20} height={20} />
              </button>
            )}
            {!fullscreen && (
              <Link href={`/edicoes/${editionId}`} className="btn-hud" aria-label="Sair" title="Sair">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </Link>
            )}
          </div>
        </header>

        <ChoiceSteps state={state} tv />

        {/* Última jogada, em destaque; a chave faz a animação repetir. */}
        <div className="choice-tv-news" aria-live="polite">
          {last ? (
            <p key={last.id} className={`choice-tv-event anim-pop ${last.kind === "veto" ? "is-ban" : ""}`}>
              <TeamShield team={last.team} size={44} />
              <span>
                <b>{nameOf(last.playerId)}</b>{" "}
                {last.kind === "veto" ? "baniu" : "escolheu"} <b>{last.team}</b>
              </span>
            </p>
          ) : (
            <p className="choice-tv-event is-idle">
              Cada jogador cita {PICKS_PER_PLAYER} times. Depois, cada um bane 1.
            </p>
          )}
        </div>

        {state.phase === "concluida" ? (
          <section>
            <h2 className="choice-tv-section">Times do sorteio</h2>
            <div className="choice-tv-final" style={{ "--cols": columns(state.remaining.length) } as CSSProperties}>
              {state.remaining.map((t, i) => (
                <div key={t} className="choice-tv-final-team anim-pop" style={{ "--i": i } as CSSProperties}>
                  <TeamShield team={t} size={96} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <p className="choice-tv-banned-line">
              Banidos:{" "}
              {state.bans.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && " · "}
                  <s>{b.team}</s> <span className="opacity-70">({nameOf(b.playerId)})</span>
                </span>
              ))}
            </p>
          </section>
        ) : (
          <div className="choice-tv-grid" style={{ "--cols": columns(players.length) } as CSSProperties}>
            {players.map((p) => {
              const picks = state.picks.filter((c) => c.playerId === p.id);
              const ban = state.bans.find((b) => b.playerId === p.id);
              const fresh = last?.playerId === p.id;
              return (
                <article key={p.id} className={`choice-tv-card ${fresh ? "is-fresh" : ""}`}>
                  <div className="choice-tv-player">
                    <Avatar name={p.name} photoUrl={p.photoUrl} avatar={p.avatar} size={48} />
                    <span className="truncate">{p.name}</span>
                  </div>
                  {Array.from({ length: PICKS_PER_PLAYER }, (_, i) => {
                    const pick = picks[i];
                    if (!pick)
                      return (
                        <div key={i} className="choice-tv-slot is-empty">
                          <span className="choice-tv-q">?</span>
                        </div>
                      );
                    const by = state.bannedBy.get(foldTeam(pick.team));
                    return (
                      <div key={pick.id} className={`choice-tv-slot anim-pop ${by != null ? "is-banned" : ""}`}>
                        <TeamShield team={pick.team} size={48} />
                        <span className="choice-tv-team">{pick.team}</span>
                        {by != null && (
                          <span className="choice-tv-stamp">
                            Banido
                            <small>por {nameOf(by)}</small>
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {state.phase === "banimento" && (
                    <p className={`choice-tv-ban ${ban ? "is-done" : ""}`}>
                      {ban ? (
                        <>
                          Baniu <b>{ban.team}</b>
                        </>
                      ) : (
                        "Ainda vai banir"
                      )}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

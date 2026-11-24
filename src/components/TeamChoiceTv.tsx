"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { isMuted, setMuted, unlockAudio } from "@/lib/sfx";
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
import { TeamDrawReveal } from "./TeamDrawReveal";
import { useWakeLock } from "./drawHooks";
import { TvGroupDraw } from "./GroupDraw";
import type { GroupDrawItem } from "@/lib/services";

/** De quanto em quanto tempo a TV busca as novidades lançadas no celular. */
const REFRESH_MS = 1500;
/** Pausa entre a revelação de um sorteio e a do próximo. */
const REST_MS = 1400;
/** Depois do último time revelado, quanto esperar até o sorteio dos grupos. */
const GROUPS_PAUSE_MS = 3500;

/** Colunas da grade, para caber todo mundo numa tela de TV (até 2 fileiras). */
const columns = (n: number) =>
  n <= 4 ? Math.max(n, 2) : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6;

function SoundIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor" />
      {off ? (
        <path d="m16 9.5 5 5M21 9.5l-5 5" />
      ) : (
        <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
      )}
    </svg>
  );
}

/**
 * Escolha e sorteio dos times projetados na TV: só mostra. O administrador
 * lança tudo pelo celular e esta tela se atualiza sozinha a cada segundo e
 * meio. Cada time sorteado é revelado com animação, um por vez.
 */
export function TeamChoiceTv({
  editionId,
  editionName,
  players,
  choices,
  withGroups,
  groups,
}: {
  editionId: number;
  editionName: string;
  players: ChoicePlayer[];
  choices: ChoiceRow[];
  /** Edição com grupos: depois dos times, vem o sorteio dos grupos. */
  withGroups: boolean;
  /** Grupos sorteados, na ordem do sorteio (null enquanto não saíram). */
  groups: GroupDrawItem[] | null;
}) {
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);
  const [muted, setMutedState] = useState(false);
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
    // lido depois de montar, para não desencontrar do HTML do servidor
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMutedState(isMuted());
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const state = useMemo(
    () =>
      choiceState(
        players.map((p) => p.id),
        choices,
      ),
    [players, choices],
  );
  const playerById = new Map(players.map((p) => [p.id, p]));
  const nameOf = (id: number) => playerById.get(id)?.name ?? "";

  // Sorteios (e trocas de time que não tem no jogo) na ordem em que saíram.
  const reveals = useMemo(
    () => [...state.draws, ...state.redraws].sort((a, b) => a.id - b.id),
    [state.draws, state.redraws],
  );
  // Sorteios já revelados. Os que já existiam ao abrir a TV não são repetidos.
  const [shown, setShown] = useState(reveals.length);
  // pausa curta entre uma revelação e a próxima, para ver o quadro atualizar
  const [resting, setResting] = useState(false);
  const drawing = !resting && reveals.length > shown ? reveals[shown] : null;
  const revealed = () => {
    setShown((s) => s + 1);
    setResting(true);
    setTimeout(() => setResting(false), REST_MS);
  };
  useEffect(() => {
    // sorteio refeito no celular: volta junto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reveals.length < shown) setShown(reveals.length);
  }, [reveals.length, shown]);

  const shownDraws = reveals.slice(0, shown);
  // Quantos do primeiro sorteio já apareceram (as trocas vêm depois).
  const shownFirst = shownDraws.filter((d) => d.kind === "sorteio").length;
  const drawPhase = state.phase === "sorteio" || state.phase === "concluida";
  const shownTeams = new Set(shownDraws.map((d) => foldTeam(d.team)));
  const inUrn = state.remaining.filter((t) => !shownTeams.has(foldTeam(t)));
  const allShown = state.phase === "concluida" && shown >= reveals.length;

  // Sorteio dos grupos: espera os times serem revelados, roda no estádio e
  // termina no quadro dos grupos. Se a TV abrir com tudo pronto, vai direto
  // para o quadro, sem repetir a animação.
  const [groupStage, setGroupStage] = useState<"wait" | "play" | "show">(
    groups && state.draws.length > 0 ? "show" : "wait",
  );
  // Só importa se os grupos existem: a lista chega nova a cada atualização da
  // TV e, se fosse dependência, a espera recomeçaria sem nunca terminar.
  const hasGroups = groups != null;
  useEffect(() => {
    if (!hasGroups) {
      // tabela desfeita no celular: volta a esperar
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroupStage("wait");
      return;
    }
    if (groupStage !== "wait" || !allShown) return;
    const go = setTimeout(() => setGroupStage("play"), GROUPS_PAUSE_MS);
    return () => clearTimeout(go);
  }, [hasGroups, groupStage, allShown]);
  // O quadro dos grupos só aparece quando o admin toca em "Ver grupos" no fim
  // do sorteio; até lá, a TV fica no estádio.
  const groupsShown = groupStage === "show" && groups != null;

  const last = drawPhase
    ? shownDraws.at(-1)
    : [...state.picks, ...state.bans].sort((a, b) => b.id - a.id)[0];

  const toggleFullscreen = () => {
    unlockAudio();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const toggleSound = () => {
    unlockAudio();
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    // qualquer toque na TV libera o som do navegador
    <div
      className="choice-tv fixed inset-0 z-50 overflow-y-auto"
      onPointerDown={unlockAudio}
    >
      <div className="choice-tv-inner">
        <header className="choice-tv-head">
          <div className="flex min-w-0 items-center gap-[1.2vw]">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem pequena e fixa, sem otimização */}
            <img src="/brasao.png" alt="" className="choice-tv-emblem" />
            <div className="min-w-0">
              <p className="choice-tv-kicker">
                {groupsShown
                  ? "Grupos sorteados"
                  : groupStage === "play"
                    ? "Sorteio dos grupos"
                    : drawPhase
                      ? "Sorteio dos times"
                      : "Escolha dos times"}
              </p>
              <h1
                className="choice-tv-title text-title"
                aria-label={editionName}
              >
                <Arcade>{editionName}</Arcade>
              </h1>
            </div>
          </div>
          <div className="choice-tv-tools">
            <button
              type="button"
              className="btn-hud"
              onClick={toggleSound}
              aria-label={muted ? "Ligar o som" : "Desligar o som"}
              title={muted ? "Ligar o som" : "Desligar o som"}
            >
              <SoundIcon off={muted} />
            </button>
            {!fullscreen && (
              <button
                type="button"
                className="btn-hud"
                onClick={toggleFullscreen}
                aria-label="Tela cheia"
                title="Tela cheia"
              >
                <ExpandIcon width={20} height={20} />
              </button>
            )}
            {!fullscreen && (
              <Link
                href={`/edicoes/${editionId}`}
                className="btn-hud"
                aria-label="Sair"
                title="Sair"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            )}
          </div>
        </header>

        <ChoiceSteps
          state={state}
          tv
          shownDraws={drawPhase ? shownFirst : undefined}
          withGroups={withGroups}
          groupsDone={groupsShown}
        />

        {/* Última jogada, em destaque; a chave faz a animação repetir. */}
        <div className="choice-tv-news" aria-live="polite">
          {groupsShown ? (
            <p className="choice-tv-event anim-pop">
              Grupos definidos! Que comece a Copinha!
            </p>
          ) : allShown ? (
            <p className="choice-tv-event">
              {withGroups
                ? "Todos os times sorteados! Agora, os grupos…"
                : "Todos os times sorteados!"}
            </p>
          ) : last ? (
            <p
              key={last.id}
              className={`choice-tv-event anim-pop ${last.kind === "veto" ? "is-ban" : ""}`}
            >
              <TeamShield team={last.team} size={44} />
              <span>
                <b>{nameOf(last.playerId)}</b>{" "}
                {last.kind === "veto"
                  ? "baniu"
                  : last.kind === "sorteio"
                    ? "vai jogar de"
                    : last.kind === "resorteio"
                      ? "agora vai jogar de"
                      : "escolheu"}{" "}
                <b>{last.team}</b>
              </span>
            </p>
          ) : drawPhase ? (
            <p className="choice-tv-event is-idle">
              Os times vão ser sorteados um por um.
            </p>
          ) : null}
        </div>

        {groupsShown ? (
          <GroupsBoard groups={groups} players={players} />
        ) : drawPhase ? (
          <>
            {inUrn.length > 0 && (
              <div className="choice-tv-urn">
                <span className="choice-tv-urn-label">Na urna</span>
                {inUrn.map((t) => (
                  <span key={t} className="choice-tv-urn-team" title={t}>
                    <TeamShield team={t} size={40} />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            )}
            <div
              className="choice-tv-grid"
              style={{ "--cols": columns(players.length) } as CSSProperties}
            >
              {players.map((p) => {
                // O time de agora: a última troca dele, se houver.
                const draw = shownDraws.findLast((d) => d.playerId === p.id);
                const fresh = last?.playerId === p.id && !allShown;
                return (
                  <article
                    key={p.id}
                    className={`choice-tv-card ${fresh ? "is-fresh" : ""} ${draw ? "has-team" : ""}`}
                  >
                    <div className="choice-tv-player">
                      <Avatar
                        name={p.name}
                        photoUrl={p.photoUrl}
                        avatar={p.avatar}
                        size={48}
                      />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {draw ? (
                      <div
                        key={draw.id}
                        className="choice-tv-slot choice-tv-drawn anim-pop"
                      >
                        <TeamShield team={draw.team} size={48} />
                        <span className="choice-tv-team">{draw.team}</span>
                      </div>
                    ) : (
                      <div className="choice-tv-slot is-empty">
                        <span className="choice-tv-q">?</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div
            className="choice-tv-grid"
            style={{ "--cols": columns(players.length) } as CSSProperties}
          >
            {players.map((p, i) => {
              const picks = state.picks.filter((c) => c.playerId === p.id);
              const ban = state.bans.find((b) => b.playerId === p.id);
              const isTurn = state.turn === p.id;
              const fresh = !isTurn && last?.playerId === p.id;
              return (
                <article
                  key={p.id}
                  className={`choice-tv-card ${fresh ? "is-fresh" : ""} ${isTurn ? "is-turn" : ""}`}
                >
                  <div className="choice-tv-player">
                    <span className="choice-tv-pos num">{i + 1}º</span>
                    <Avatar
                      name={p.name}
                      photoUrl={p.photoUrl}
                      avatar={p.avatar}
                      size={48}
                    />
                    <span className="truncate">{p.name}</span>
                    {isTurn && (
                      <span className="choice-tv-turn">
                        {state.phase === "escolha" ? "Escolhendo" : "Banindo"}
                      </span>
                    )}
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
                      <div
                        key={pick.id}
                        className={`choice-tv-slot anim-pop ${by != null ? "is-banned" : ""}`}
                      >
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

        {drawing && playerById.has(drawing.playerId) && (
          <TeamDrawReveal
            key={drawing.id}
            player={playerById.get(drawing.playerId)!}
            team={drawing.team}
            // Na troca, a roleta gira pelos times banidos.
            candidates={
              drawing.kind === "resorteio" ? state.bans.map((b) => b.team) : inUrn
            }
            number={shownFirst + 1}
            total={players.length}
            countLabel={drawing.kind === "resorteio" ? "Novo sorteio" : undefined}
            onDone={revealed}
          />
        )}

        {groupStage === "play" && groups && (
          <TvGroupDraw
            items={groups}
            onClose={() => setGroupStage("show")}
          />
        )}
      </div>
    </div>
  );
}

/** Quadro final: cada grupo com os jogadores e os times sorteados. */
function GroupsBoard({
  groups,
  players,
}: {
  groups: GroupDrawItem[];
  players: ChoicePlayer[];
}) {
  const labels = [...new Set(groups.map((g) => g.groupLabel ?? ""))].sort();
  const photoOf = (name: string) =>
    players.find((p) => p.name === name)?.photoUrl ?? null;
  return (
    <section>
      <h2 className="choice-tv-section">Grupos sorteados</h2>
      <div
        className="choice-tv-groups"
        style={{ "--cols": Math.min(labels.length, 4) } as CSSProperties}
      >
        {labels.map((label, i) => (
          <div
            key={label}
            className="choice-tv-group anim-pop"
            style={{ "--i": i } as CSSProperties}
          >
            <h3 className="choice-tv-group-title">Grupo {label}</h3>
            {groups
              .filter((g) => (g.groupLabel ?? "") === label)
              .map((g) => (
                <div key={g.entryId} className="choice-tv-group-row">
                  <Avatar
                    name={g.playerName}
                    photoUrl={photoOf(g.playerName)}
                    avatar={g.avatar}
                    size={40}
                  />
                  <span className="choice-tv-group-name">{g.playerName}</span>
                  <TeamShield team={g.teamName} size={36} />
                  <span className="choice-tv-group-team">{g.teamName}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

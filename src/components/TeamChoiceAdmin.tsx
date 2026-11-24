"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addTeamPickAction,
  banTeamAction,
  drawChoiceGroupsAction,
  redrawFromBansAction,
  drawChoiceTeamsAction,
  removeTeamChoiceAction,
  resetTeamChoicesAction,
  resetTeamDrawAction,
} from "@/app/actions";
import type { AvatarLook } from "@/lib/sprite";
import {
  BANS_PER_PLAYER,
  PICKS_PER_PLAYER,
  choiceState,
  foldTeam,
  type ChoiceRow,
} from "@/lib/teamChoice";
import { Avatar } from "./Avatar";
import { useConfirm } from "./ConfirmDialog";
import { TeamAutocomplete } from "./TeamAutocomplete";
import { TeamShield } from "./TeamShield";
import { ChoiceSteps } from "./TeamChoiceSteps";
import { ShuffleIcon } from "./icons";

export interface ChoicePlayer {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
}

function TvIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function UndoButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="choice-undo"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * Controle da escolha dos times, no celular do administrador: lança os times
 * citados por cada jogador e depois os banimentos. A TV acompanha sozinha.
 */
export function TeamChoiceAdmin({
  editionId,
  previousName,
  withGroups,
  locked,
  players,
  choices,
  knownTeams,
}: {
  editionId: number;
  /** Edição que define a ordem da vez (null = sem anterior encerrada). */
  previousName: string | null;
  /** Edição com grupos: o sorteio dos times já sorteia os grupos também. */
  withGroups: boolean;
  /** A tabela já foi gerada: só dá para ver, não mudar. */
  locked: boolean;
  /** Já na ordem da vez. */
  players: ChoicePlayer[];
  choices: ChoiceRow[];
  knownTeams: string[];
}) {
  const state = useMemo(
    () => choiceState(players.map((p) => p.id), choices),
    [players, choices],
  );
  const [team, setTeam] = useState("");
  const [showDraws, setShowDraws] = useState(false);
  // Quem caiu com time que não tem no jogo (para sortear de novo entre os
  // últimos banidos).
  const [missing, setMissing] = useState<number[]>([]);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();

  const picksOf = (id: number) => state.picks.filter((p) => p.playerId === id);
  const banOf = (id: number) => state.bans.find((b) => b.playerId === id);
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "";

  // A ordem sugerida é a da colocação na edição anterior (players já vem
  // nela), mas o admin pode tocar em qualquer jogador que ainda falta e
  // escolher por ele, fora da vez.
  const turn = state.turn;
  const doneWith = (id: number) =>
    state.phase === "escolha"
      ? picksOf(id).length >= PICKS_PER_PLAYER
      : banOf(id) != null;
  const [picked, setPicked] = useState<number | null>(null);
  // Quem já terminou (ou mudou de fase) volta para a ordem da vez.
  const acting =
    picked != null && players.some((p) => p.id === picked) && !doneWith(picked)
      ? picked
      : turn;
  const outOfOrder = acting != null && acting !== turn;

  const act = (fn: () => Promise<{ error?: string } | null>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
      else after?.();
    });

  const cite = (e: React.FormEvent) => {
    e.preventDefault();
    if (acting == null || !team.trim()) return;
    act(
      () => addTeamPickAction(editionId, acting, team),
      () => setTeam(""),
    );
  };

  const ban = () => {
    if (acting == null || !banTarget) return;
    act(
      () => banTeamAction(editionId, acting, banTarget),
      () => setBanTarget(null),
    );
  };

  const reset = async () => {
    const ok = await ask({
      title: "Recomeçar",
      message:
        "Apagar todos os times citados e os banimentos desta edição? A lista do sorteio continua como está.",
      confirmLabel: "Recomeçar",
      danger: true,
    });
    if (ok) act(() => resetTeamChoicesAction(editionId));
  };

  const drawAll = async () => {
    if (
      withGroups &&
      !(await ask({
        title: "Sortear times e grupos",
        message:
          "Sortear os times e, em seguida, os grupos? A tabela de jogos é gerada junto, e a TV mostra tudo, um por um.",
        confirmLabel: "Sortear",
      }))
    )
      return;
    act(() => drawChoiceTeamsAction(editionId));
  };
  // Se os grupos não saíram junto (ex.: grupos montados pela metade), sorteia depois.
  const drawGroups = () => act(() => drawChoiceGroupsAction(editionId));

  const resetDraw = async () => {
    const ok = await ask({
      title: "Refazer sorteio",
      message:
        "Tirar os times sorteados de todos os jogadores e sortear de novo? Os times citados e os banimentos continuam.",
      confirmLabel: "Refazer",
      danger: true,
    });
    if (ok) act(() => resetTeamDrawAction(editionId));
  };

  // Os times sorteados só aparecem aqui quando o admin pede, para não estragar
  // a revelação na TV.
  const drawOf = (id: number) => (showDraws ? state.teamOf.get(id) : undefined);
  const toggleMissing = (id: number) =>
    setMissing((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const canRedraw = state.phase === "concluida" && showDraws;
  const nextBans = state.redrawPool.slice(0, Math.max(missing.length, 1));
  const redraw = async () => {
    const ok = await ask({
      title: "Sortear de novo",
      message: `Sortear para ${missing.map(nameOf).join(", ")} entre os últimos banidos (${state.redrawPool
        .slice(0, missing.length)
        .join(", ")})? Só o time muda; jogos e grupos continuam. A TV mostra o novo sorteio.`,
      confirmLabel: "Sortear",
    });
    if (ok) act(() => redrawFromBansAction(editionId, missing), () => setMissing([]));
  };
  const pickedNames = state.picks.map((p) => p.team);
  const open = state.picks.filter((p) => !state.bannedBy.has(foldTeam(p.team)));

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-4">
        <ChoiceSteps state={state} withGroups={withGroups} groupsDone={locked} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/edicoes/${editionId}/escolha/tv`}
            target="_blank"
            className="btn"
          >
            <TvIcon />
            Abrir na TV
          </Link>
          {choices.length > 0 && !locked && (
            <button type="button" className="btn btn-danger" onClick={reset} disabled={pending}>
              Recomeçar
            </button>
          )}
        </div>
      </div>

      {(state.phase === "escolha" || state.phase === "banimento") && (
        <div className="card flex flex-col gap-4 p-4">
          <div>
            <p className="label">
              {state.phase === "escolha" ? "Ordem da escolha" : "Ordem do banimento"}
            </p>
            <ol className="choice-order">
              {players.map((p, i) => {
                const count =
                  state.phase === "escolha"
                    ? `${picksOf(p.id).length}/${PICKS_PER_PLAYER}`
                    : `${banOf(p.id) ? 1 : 0}/${BANS_PER_PLAYER}`;
                const done = doneWith(p.id);
                return (
                  <li
                    key={p.id}
                    className={acting === p.id ? "is-turn" : done ? "is-done" : ""}
                    aria-current={acting === p.id ? "step" : undefined}
                  >
                    <button
                      type="button"
                      className="choice-order-btn"
                      disabled={done || pending}
                      onClick={() => setPicked(p.id === turn ? null : p.id)}
                      title={done ? undefined : `Escolher por ${p.name}`}
                    >
                      <span className="num choice-order-pos">{i + 1}º</span>
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="num choice-order-count">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[13px] font-bold text-muted">
              {previousName
                ? `Pela colocação na ${previousName}. Quem não jogou ou é estreante vai por último.`
                : "Sem edição anterior encerrada: vale a ordem de inscrição."}{" "}
              Toque em outro jogador para escolher por ele fora da vez.
            </p>
          </div>

          {state.phase === "escolha" && acting != null && (
            <form onSubmit={cite} className="flex flex-col gap-2">
              <label className="label" htmlFor="choice-team">
                {outOfOrder ? "Fora da vez: " : "Vez de "}
                {nameOf(acting)} · {picksOf(acting).length + 1}º time
              </label>
              <div className="flex gap-2">
                <TeamAutocomplete
                  name="team"
                  value={team}
                  onChange={setTeam}
                  options={knownTeams}
                  taken={pickedNames}
                  ariaLabel={`Time citado por ${nameOf(acting)}`}
                  className="min-w-0 flex-1"
                />
                <button type="submit" className="btn btn-primary" disabled={pending || !team.trim()}>
                  Citar
                </button>
              </div>
            </form>
          )}

          {state.phase === "banimento" && acting != null && (
            <div className="flex flex-col gap-3">
              <p className="label">
                {outOfOrder
                  ? `Fora da vez: ${nameOf(acting)} bane`
                  : `Vez de ${nameOf(acting)} banir`}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {open.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="choice-pick"
                    aria-pressed={banTarget === p.team}
                    onClick={() => setBanTarget(p.team)}
                    disabled={pending}
                  >
                    <TeamShield team={p.team} size={30} />
                    <span className="min-w-0 flex-1 truncate text-left">{p.team}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-alert"
                disabled={!banTarget || pending}
                onClick={ban}
              >
                {banTarget ? `Banir ${banTarget}` : "Escolha um time"}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-body font-bold text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {(state.phase === "sorteio" || state.phase === "concluida") && (
        <div className="card flex flex-col gap-4 p-4">
          {state.phase === "sorteio" ? (
            <>
              <p className="label">
                {state.draws.length ? "Times que ainda vão sair" : "Times do sorteio"}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {state.undrawn.map((t) => (
                  <span key={t} className="choice-pick">
                    <TeamShield team={t} size={30} />
                    <span className="min-w-0 flex-1 truncate">{t}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="label">Sorteio concluído</p>
          )}
          {state.phase === "sorteio" ? (
            <>
              <p className="text-body text-muted">
                {withGroups
                  ? "Um toque sorteia os times e depois os grupos. A TV revela tudo, sozinha."
                  : "Um toque sorteia todos. A TV revela um por um, sozinha."}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={drawAll}
                disabled={pending}
              >
                <ShuffleIcon width={20} height={20} />
                {pending ? "Sorteando..." : withGroups ? "Sortear times e grupos" : "Sortear times"}
              </button>
            </>
          ) : (
            <>
              <p className="text-body text-muted">
                {withGroups && locked
                  ? "Times e grupos sorteados, e a tabela de jogos já está pronta. A TV está revelando tudo; aqui fica escondido para não estragar a surpresa."
                  : "Os times já foram sorteados, e a TV está revelando um por um. Aqui eles ficam escondidos para não estragar a surpresa. Depois, na edição, é só gerar a tabela."}
              </p>
              {withGroups && !locked && (
                <button type="button" className="btn btn-primary" onClick={drawGroups} disabled={pending}>
                  <ShuffleIcon width={20} height={20} />
                  {pending ? "Sorteando..." : "Sortear grupos"}
                </button>
              )}
              <button
                type="button"
                className="btn"
                aria-pressed={showDraws}
                onClick={() => setShowDraws((v) => !v)}
              >
                {showDraws ? "Esconder times sorteados" : "Ver times sorteados"}
              </button>
              {canRedraw && (
                <div className="choice-redraw">
                  <p className="label">Time que não tem no jogo</p>
                  <p className="text-body text-muted">
                    Marque abaixo quem caiu com time que não existe no jogo. Eles
                    ganham um novo sorteio entre os últimos times banidos
                    {state.redrawPool.length
                      ? ` (próximos: ${nextBans.join(", ")})`
                      : ", mas não sobrou nenhum"}
                    .
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={redraw}
                    disabled={pending || missing.length === 0}
                  >
                    <ShuffleIcon width={20} height={20} />
                    {missing.length
                      ? `Sortear de novo para ${missing.length} ${missing.length === 1 ? "jogador" : "jogadores"}`
                      : "Marque os jogadores"}
                  </button>
                </div>
              )}
              <Link href={`/edicoes/${editionId}`} className="btn btn-primary">
                Voltar para a edição
              </Link>
            </>
          )}
          {state.draws.length > 0 && !locked && (
            <button type="button" className="btn btn-danger" onClick={resetDraw} disabled={pending}>
              Refazer sorteio
            </button>
          )}
          {error && (
            <p role="alert" className="text-body font-bold text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {players.map((p) => {
          const ban = banOf(p.id);
          return (
            <div key={p.id} className="card flex flex-col gap-2.5 p-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={p.name} photoUrl={p.photoUrl} avatar={p.avatar} size={34} />
                <span className="min-w-0 flex-1 truncate text-name font-black">{p.name}</span>
                {ban && (
                  <span className="choice-ban-tag">
                    Baniu {ban.team}
                    {state.draws.length === 0 && (
                      <UndoButton
                        label={`Desfazer banimento de ${ban.team}`}
                        disabled={pending}
                        onClick={() => act(() => removeTeamChoiceAction(ban.id))}
                      />
                    )}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: PICKS_PER_PLAYER }, (_, i) => {
                  const pick = picksOf(p.id)[i];
                  if (!pick)
                    return (
                      <span key={i} className="choice-slot-empty">
                        Time {i + 1}
                      </span>
                    );
                  const by = state.bannedBy.get(foldTeam(pick.team));
                  return (
                    <span key={pick.id} className={`choice-pick ${by != null ? "is-banned" : ""}`}>
                      <TeamShield team={pick.team} size={26} />
                      <span className="min-w-0 flex-1 truncate">{pick.team}</span>
                      {state.bans.length === 0 && (
                        <UndoButton
                          label={`Tirar ${pick.team}`}
                          disabled={pending}
                          onClick={() => act(() => removeTeamChoiceAction(pick.id))}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
              {drawOf(p.id) && (
                <p className="choice-drawn">
                  <TeamShield team={drawOf(p.id)!} size={26} />
                  <span className="min-w-0 flex-1 truncate">
                    Vai jogar de <b>{drawOf(p.id)}</b>
                  </span>
                  {canRedraw && (
                    <label className="choice-missing">
                      <input
                        type="checkbox"
                        checked={missing.includes(p.id)}
                        onChange={() => toggleMissing(p.id)}
                        className="size-4 accent-accent"
                      />
                      Não tem no jogo
                    </label>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}

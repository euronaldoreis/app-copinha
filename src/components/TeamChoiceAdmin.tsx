"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addTeamPickAction,
  banTeamAction,
  drawChoiceGroupsAction,
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
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();

  const picksOf = (id: number) => state.picks.filter((p) => p.playerId === id);
  const banOf = (id: number) => state.bans.find((b) => b.playerId === id);
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "";

  // A vez é fixa: a ordem da colocação na edição anterior (players já vem nela).
  const turn = state.turn;
  const doneWith = (id: number) =>
    state.phase === "escolha"
      ? picksOf(id).length >= PICKS_PER_PLAYER
      : banOf(id) != null;

  const act = (fn: () => Promise<{ error?: string } | null>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
      else after?.();
    });

  const cite = (e: React.FormEvent) => {
    e.preventDefault();
    if (turn == null || !team.trim()) return;
    act(
      () => addTeamPickAction(editionId, turn, team),
      () => setTeam(""),
    );
  };

  const ban = () => {
    if (turn == null || !banTarget) return;
    act(
      () => banTeamAction(editionId, turn, banTarget),
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
  const drawOf = (id: number) =>
    showDraws ? state.draws.find((d) => d.playerId === id) : undefined;
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
                return (
                  <li
                    key={p.id}
                    className={turn === p.id ? "is-turn" : doneWith(p.id) ? "is-done" : ""}
                    aria-current={turn === p.id ? "step" : undefined}
                  >
                    <span className="num choice-order-pos">{i + 1}º</span>
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="num choice-order-count">{count}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[13px] font-bold text-muted">
              {previousName
                ? `Pela colocação na ${previousName}. Quem não jogou ou é estreante vai por último.`
                : "Sem edição anterior encerrada: vale a ordem de inscrição."}
            </p>
          </div>

          {state.phase === "escolha" && turn != null && (
            <form onSubmit={cite} className="flex flex-col gap-2">
              <label className="label" htmlFor="choice-team">
                Vez de {nameOf(turn)} · {picksOf(turn).length + 1}º time
              </label>
              <div className="flex gap-2">
                <TeamAutocomplete
                  name="team"
                  value={team}
                  onChange={setTeam}
                  options={knownTeams}
                  taken={pickedNames}
                  ariaLabel={`Time citado por ${nameOf(turn)}`}
                  className="min-w-0 flex-1"
                />
                <button type="submit" className="btn btn-primary" disabled={pending || !team.trim()}>
                  Citar
                </button>
              </div>
            </form>
          )}

          {state.phase === "banimento" && turn != null && (
            <div className="flex flex-col gap-3">
              <p className="label">Vez de {nameOf(turn)} banir</p>
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
                  <TeamShield team={drawOf(p.id)!.team} size={26} />
                  <span className="min-w-0 truncate">
                    Vai jogar de <b>{drawOf(p.id)!.team}</b>
                  </span>
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

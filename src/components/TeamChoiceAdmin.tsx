"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addTeamPickAction,
  banTeamAction,
  removeTeamChoiceAction,
  resetTeamChoicesAction,
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
  players,
  choices,
  knownTeams,
}: {
  editionId: number;
  players: ChoicePlayer[];
  choices: ChoiceRow[];
  knownTeams: string[];
}) {
  const state = useMemo(
    () => choiceState(players.map((p) => p.id), choices),
    [players, choices],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [team, setTeam] = useState("");
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();

  const picksOf = (id: number) => state.picks.filter((p) => p.playerId === id);
  const banOf = (id: number) => state.bans.find((b) => b.playerId === id);
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "";

  // Quem ainda pode agir nesta fase; a vez sugerida é quem fez menos até agora.
  const canAct = (id: number) =>
    state.phase === "escolha"
      ? picksOf(id).length < PICKS_PER_PLAYER
      : state.phase === "banimento"
        ? !banOf(id)
        : false;
  const suggested = [...players]
    .filter((p) => canAct(p.id))
    .sort((a, b) => picksOf(a.id).length - picksOf(b.id).length)[0]?.id;
  const turn = picked != null && canAct(picked) ? picked : (suggested ?? null);

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
      () => {
        setTeam("");
        setPicked(null);
      },
    );
  };

  const ban = () => {
    if (turn == null || !banTarget) return;
    act(
      () => banTeamAction(editionId, turn, banTarget),
      () => {
        setBanTarget(null);
        setPicked(null);
      },
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

  const pickedNames = state.picks.map((p) => p.team);
  const open = state.picks.filter((p) => !state.bannedBy.has(foldTeam(p.team)));

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-4">
        <ChoiceSteps state={state} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/edicoes/${editionId}/escolha/tv`}
            target="_blank"
            className="btn"
          >
            <TvIcon />
            Abrir na TV
          </Link>
          {choices.length > 0 && (
            <button type="button" className="btn btn-danger" onClick={reset} disabled={pending}>
              Recomeçar
            </button>
          )}
        </div>
      </div>

      {state.phase !== "concluida" && (
        <div className="card flex flex-col gap-4 p-4">
          <div>
            <p className="label">
              {state.phase === "escolha" ? "Quem está citando?" : "Quem vai banir?"}
            </p>
            <div className="-mx-1 flex flex-wrap gap-1.5">
              {players.map((p) => {
                const done = !canAct(p.id);
                const count =
                  state.phase === "escolha"
                    ? `${picksOf(p.id).length}/${PICKS_PER_PLAYER}`
                    : `${banOf(p.id) ? 1 : 0}/${BANS_PER_PLAYER}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="chip gap-2 !px-3 disabled:opacity-45"
                    aria-pressed={turn === p.id}
                    disabled={done || pending}
                    onClick={() => {
                      setPicked(p.id);
                      setError(null);
                    }}
                  >
                    {p.name}
                    <span className="num font-sans text-[12px] font-black opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {state.phase === "escolha" && turn != null && (
            <form onSubmit={cite} className="flex flex-col gap-2">
              <label className="label" htmlFor="choice-team">
                Time citado por {nameOf(turn)}
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
              <p className="label">Time que {nameOf(turn)} vai banir</p>
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

      {state.phase === "concluida" && (
        <div className="card flex flex-col gap-4 p-4">
          <p className="label">Times do sorteio</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {state.remaining.map((t, i) => (
              <span key={t} className="choice-pick anim-pop" style={{ "--i": i } as React.CSSProperties}>
                <TeamShield team={t} size={30} />
                <span className="min-w-0 flex-1 truncate">{t}</span>
              </span>
            ))}
          </div>
          <p className="text-body text-muted">
            Esses times já estão na lista do sorteio da edição.
          </p>
          <Link href={`/edicoes/${editionId}`} className="btn btn-primary">
            Ir para o sorteio
          </Link>
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
                    <UndoButton
                      label={`Desfazer banimento de ${ban.team}`}
                      disabled={pending}
                      onClick={() => act(() => removeTeamChoiceAction(ban.id))}
                    />
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
            </div>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}

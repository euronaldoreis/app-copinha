"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Avatar } from "./Avatar";
import { CheckIcon, PencilIcon } from "./icons";
import { ScoreDialog } from "./ScoreDialog";
import type { MatchSide } from "./TeamShield";

export type { MatchSide } from "./TeamShield";

export interface MatchCardProps {
  matchId: number;
  /** Número do jogo na edição (aparece como "Jogo 01"). */
  number: number;
  /** Fase do jogo na faixa do topo (ex.: "Grupo A", "Semifinal"). */
  label: string;
  knockout: boolean;
  home: MatchSide | null;
  away: MatchSide | null;
  /** Texto de quem ainda vai ocupar a vaga (ex.: "1º do Grupo A"). */
  homePlaceholder: string;
  awayPlaceholder: string;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  admin: boolean;
}

/** Tamanho do cartão do jogador nos confrontos. */
const CARD_SIZE = 56;

function Side({
  side,
  placeholder,
  dimmed,
}: {
  side: MatchSide | null;
  placeholder: string;
  dimmed: boolean;
}) {
  if (!side) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
        {/* vaga ainda sem dono: cartão vazio com "?" */}
        <span
          style={{ width: CARD_SIZE, height: CARD_SIZE }}
          className="grid shrink-0 place-items-center rounded-[22%] border-2 border-night bg-[#c5d0ea] font-pixel text-[24px] text-[#4a6cb8] shadow-soft"
          aria-hidden="true"
        >
          ?
        </span>
        <span className="font-score text-[14px] font-bold leading-tight text-[#4a6cb8]">
          {placeholder}
        </span>
      </div>
    );
  }
  return (
    <Link
      href={`/jogadores/${side.playerId}`}
      className={`flex min-w-0 flex-col items-center gap-1.5 text-center ${dimmed ? "opacity-55" : ""}`}
    >
      <Avatar
        name={side.name}
        photoUrl={side.photoUrl}
        avatar={side.avatar}
        size={CARD_SIZE}
      />
      <span className="max-w-full truncate font-score text-[17px] font-black leading-tight text-[#1c3a6d]">
        {side.name}
      </span>
      {side.team && (
        <span className="-mt-1.5 max-w-full truncate font-score text-[13px] font-bold leading-tight text-[#4a6cb8]">
          {side.team}
        </span>
      )}
    </Link>
  );
}

/**
 * Cartão de um jogo: faixa com a fase, o cartão de cada jogador com o nome e o
 * time embaixo, placar e botão de placar.
 */
export function MatchCard(props: MatchCardProps) {
  const { home, away, homeScore, awayScore, homePens, awayPens } = props;
  const played = homeScore != null && awayScore != null;
  const editable = props.admin && home != null && away != null;
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  // Quem venceu (inclusive nos pênaltis) fica em destaque; o outro, apagado.
  const homeAhead = played
    ? homeScore - awayScore || (homePens ?? 0) - (awayPens ?? 0)
    : 0;

  const number = String(props.number).padStart(2, "0");

  return (
    <article className="match-card">
      <header className="match-card-head">
        <span className="truncate">
          Jogo {number} · {props.label}
        </span>
        {played ? (
          <span className="flex shrink-0 items-center gap-1 text-accent">
            <CheckIcon width={14} height={14} strokeWidth={3} />
            Concluída
          </span>
        ) : (
          <span className="shrink-0 text-faint">A jogar</span>
        )}
      </header>

      <div className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Side
            side={home}
            placeholder={props.homePlaceholder}
            dimmed={homeAhead < 0}
          />
          <span className="flex min-w-[88px] flex-col items-center">
            {played ? (
              <span className="font-pixel text-[28px] leading-none text-[#0e1f5c]">
                {homeScore} : {awayScore}
              </span>
            ) : (
              <span className="font-pixel text-[26px] leading-none text-[#4a5f93]">
                VS
              </span>
            )}
            {played && homePens != null && awayPens != null && (
              <span className="num mt-1 text-[13px] font-bold text-[#4a5f93]">
                pên. {homePens}–{awayPens}
              </span>
            )}
            {home && away && (
              <Link
                href={`/confronto?a=${home.playerId}&b=${away.playerId}`}
                className="match-card-h2h"
              >
                Retrospecto
              </Link>
            )}
          </span>
          <Side
            side={away}
            placeholder={props.awayPlaceholder}
            dimmed={homeAhead > 0}
          />
        </div>

        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn mt-4 w-full"
          >
            <PencilIcon width={18} height={18} />
            {played ? "Editar placar" : "Lançar placar"}
          </button>
        )}
      </div>

      {editing && home && away && (
        <ScoreDialog
          matchId={props.matchId}
          knockout={props.knockout}
          home={home}
          away={away}
          initial={{ homeScore, awayScore, homePens, awayPens }}
          onClose={close}
        />
      )}
    </article>
  );
}

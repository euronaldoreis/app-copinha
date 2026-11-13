"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clearResultAction, saveResultAction } from "@/app/actions";

export interface MatchSide {
  playerId: number;
  name: string;
  team: string | null;
}

export interface MatchRowProps {
  matchId: number;
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

function Side({
  side,
  placeholder,
  align,
  dimmed,
}: {
  side: MatchSide | null;
  placeholder: string;
  align: "left" | "right";
  dimmed: boolean;
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  if (!side) {
    return (
      <span className={`min-w-0 text-body text-faint ${alignClass}`}>
        {placeholder}
      </span>
    );
  }
  return (
    <Link
      href={`/jogadores/${side.playerId}`}
      className={`min-w-0 ${alignClass}`}
    >
      <span
        className={`block truncate text-name ${
          dimmed ? "text-muted" : "font-semibold"
        }`}
      >
        {side.name}
      </span>
      {side.team && (
        <span className="block truncate text-body text-muted">{side.team}</span>
      )}
    </Link>
  );
}

const scoreInput = "field num w-12 px-0 text-center";

export function MatchRow(props: MatchRowProps) {
  const { home, away, homeScore, awayScore, homePens, awayPens } = props;
  const played = homeScore != null && awayScore != null;
  const editable = props.admin && home != null && away != null;

  const [editing, setEditing] = useState(false);
  const [hs, setHs] = useState("");
  const [as, setAs] = useState("");
  const [hp, setHp] = useState("");
  const [ap, setAp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setHs(homeScore?.toString() ?? "");
    setAs(awayScore?.toString() ?? "");
    setHp(homePens?.toString() ?? "");
    setAp(awayPens?.toString() ?? "");
    setError(null);
    setEditing(true);
  };

  const finish = (action: () => ReturnType<typeof saveResultAction>) =>
    startTransition(async () => {
      const state = await action();
      if (state?.error) setError(state.error);
      else setEditing(false);
    });

  const needsPens = props.knockout && hs !== "" && hs === as;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    finish(() =>
      saveResultAction(props.matchId, {
        homeScore: hs,
        awayScore: as,
        homePens: hp,
        awayPens: ap,
      }),
    );
  };

  // Quem venceu (inclusive nos pênaltis) fica em destaque; o outro, apagado.
  const homeAhead = played
    ? homeScore - awayScore || (homePens ?? 0) - (awayPens ?? 0)
    : 0;

  const scoreline = played ? (
    <span className="flex flex-col items-center gap-1">
      {/* Placar eletrônico: um dígito aceso para cada lado. */}
      <span className="flex items-center gap-1">
        <span className="led">{homeScore}</span>
        <span className="led">{awayScore}</span>
      </span>
      {homePens != null && awayPens != null && (
        <span className="num text-body text-muted">
          pên. {homePens}–{awayPens}
        </span>
      )}
    </span>
  ) : editable ? (
    <span className="btn btn-primary min-h-8 px-2">Placar</span>
  ) : (
    <span className="font-pixel text-[10px] text-faint">VS</span>
  );

  return (
    <div className="py-3">
      <form
        onSubmit={save}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
      >
        <Side
          side={home}
          placeholder={props.homePlaceholder}
          align="right"
          dimmed={homeAhead < 0}
        />
        {editing ? (
          <span className="flex items-center gap-1.5">
            <input
              className={scoreInput}
              inputMode="numeric"
              aria-label={`Gols de ${home?.name}`}
              value={hs}
              onChange={(e) => setHs(e.target.value.replace(/\D/g, "").slice(0, 2))}
              autoFocus
            />
            <span className="text-faint">×</span>
            <input
              className={scoreInput}
              inputMode="numeric"
              aria-label={`Gols de ${away?.name}`}
              value={as}
              onChange={(e) => setAs(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
          </span>
        ) : editable ? (
          <button
            type="button"
            onClick={open}
            aria-label={played ? "Corrigir placar" : "Lançar placar"}
            className="min-w-16 cursor-pointer"
          >
            {scoreline}
          </button>
        ) : (
          <span className="flex min-w-16 justify-center">{scoreline}</span>
        )}
        <Side
          side={away}
          placeholder={props.awayPlaceholder}
          align="left"
          dimmed={homeAhead > 0}
        />

        {editing && (
          <div className="col-span-3 flex flex-col items-center gap-3 pt-1">
            {needsPens && (
              <span className="flex items-center gap-1.5 text-body text-muted">
                <span className="mr-1.5">Pênaltis</span>
                <input
                  className={scoreInput}
                  inputMode="numeric"
                  aria-label={`Pênaltis de ${home?.name}`}
                  value={hp}
                  onChange={(e) =>
                    setHp(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                />
                <span className="text-faint">×</span>
                <input
                  className={scoreInput}
                  inputMode="numeric"
                  aria-label={`Pênaltis de ${away?.name}`}
                  value={ap}
                  onChange={(e) =>
                    setAp(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                />
              </span>
            )}
            {error && (
              <p role="alert" className="text-body text-danger">
                {error}
              </p>
            )}
            <span className="flex flex-wrap justify-center gap-1">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                Salvar
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setEditing(false)}
                disabled={pending}
              >
                Cancelar
              </button>
              {played && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={pending}
                  onClick={() => finish(() => clearResultAction(props.matchId))}
                >
                  Apagar placar
                </button>
              )}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}

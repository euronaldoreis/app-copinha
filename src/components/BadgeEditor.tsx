/* eslint-disable @next/next/no-img-element -- escudos vêm da API-Football ou de links quaisquer */
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  chooseTeamBadgeAction,
  fillLeagueBadgesAction,
  searchTeamBadgesAction,
  setTeamBadgeAction,
} from "@/app/actions";
import type { BadgeCandidate } from "@/lib/apiFootball";
import { ActionForm, SubmitButton } from "./forms";
import { CheckIcon } from "./icons";

/** Escudo de um time: busca na API-Football, link colado à mão ou remover. */
export function BadgeEditor({
  teamId,
  teamName,
  badgeUrl,
  suggestedTerm,
  hasKey,
}: {
  teamId: number;
  teamName: string;
  badgeUrl: string | null;
  suggestedTerm: string;
  hasKey: boolean;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(suggestedTerm);
  const [results, setResults] = useState<BadgeCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const search = () =>
    start(async () => {
      setError(null);
      const res = await searchTeamBadgesAction(teamId, term);
      if ("error" in res) {
        setError(res.error ?? "Erro na busca.");
        setResults(null);
      } else setResults(res.candidates);
    });

  const choose = (url: string) =>
    start(async () => {
      setError(null);
      const res = await chooseTeamBadgeAction(teamId, url);
      if ("error" in res) setError(res.error ?? "Erro ao salvar.");
      else {
        setResults(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-night/5 p-3">
      {hasKey ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <input
            className="field min-w-[12rem] flex-1"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            maxLength={60}
            aria-label={`Nome para buscar o escudo de ${teamName}`}
            placeholder="Nome do time em inglês"
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Buscando..." : "Buscar escudo"}
          </button>
        </form>
      ) : (
        <p className="text-body text-muted">
          A busca automática precisa da chave da API-Football (veja o README).
          Enquanto isso, dá para colar o link de uma imagem.
        </p>
      )}

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="text-body text-muted">
          Nada encontrado. Tente o nome em inglês ou só uma parte dele.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="badge-results" aria-label="Escudos encontrados">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="badge-option"
                disabled={pending}
                onClick={() => choose(c.logo)}
                title={`Usar o escudo de ${c.name}`}
              >
                <img
                  src={`/escudo/previa/${c.id}`}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                />
                <span className="min-w-0">
                  <span className="block truncate font-black">{c.name}</span>
                  <span className="badge-country block truncate">{c.country}</span>
                </span>
                {c.logo === badgeUrl && <CheckIcon width={18} height={18} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={setTeamBadgeAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <input
          name="badgeUrl"
          type="url"
          className="field min-w-[12rem] flex-1"
          defaultValue={badgeUrl ?? ""}
          placeholder="https://... (link da imagem)"
          aria-label={`Link do escudo de ${teamName}`}
        />
        <SubmitButton className="btn" title="Salvar link">
          Salvar link
        </SubmitButton>
      </ActionForm>
      {badgeUrl && (
        <ActionForm action={setTeamBadgeAction}>
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="badgeUrl" value="" />
          <SubmitButton className="btn btn-danger" confirm={`Tirar o escudo de ${teamName}?`}>
            Tirar escudo
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Plano grátis: 10 consultas por minuto. Uma a cada 6,5 s fica com folga.
const GAP_MS = 6500;

type Line = {
  league: string;
  text: string;
  tone?: "ok" | "warn" | "error";
  /** Times da liga que a busca não achou (para buscar um a um). */
  missing?: string[];
};

/**
 * Preenche os escudos que faltam, liga por liga (uma consulta por liga),
 * respeitando o limite por minuto do plano grátis.
 */
export function BadgeAutoFill({
  coverage,
  hasKey,
}: {
  coverage: { league: string; teams: number; missing: number }[];
  hasKey: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const todo = coverage.filter((c) => c.missing > 0);
  const missing = todo.reduce((n, c) => n + c.missing, 0);

  const run = async () => {
    setRunning(true);
    setLines([]);
    const log = (line: Line) =>
      setLines((cur) => [...cur.filter((l) => l.league !== line.league), line]);
    // Temporada mais recente que o plano liberou; vale para as ligas seguintes.
    let maxSeason: number | undefined;
    let calls = 0;
    for (const { league } of todo) {
      if (calls > 0) await sleep(GAP_MS);
      log({ league, text: "buscando..." });
      let res = await fillLeagueBadgesAction(league, maxSeason);
      if ("error" in res && res.waitMinute) {
        log({ league, text: "limite por minuto: esperando 1 minuto..." });
        await sleep(61000);
        res = await fillLeagueBadgesAction(league, maxSeason);
      }
      if ("error" in res) {
        log({ league, text: res.error ?? "erro", tone: "error" });
        if (!res.waitMinute) break;
        continue;
      }
      calls = res.calls;
      maxSeason = res.season ?? maxSeason;
      log({
        league,
        tone: res.missing.length ? "warn" : "ok",
        text: `${res.matched.length} escudo${res.matched.length === 1 ? "" : "s"} novo${res.matched.length === 1 ? "" : "s"}`,
        missing: res.missing,
      });
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="card flex flex-col gap-3 p-5">
      <p className="text-body text-muted">
        {missing > 0
          ? `${missing} ${missing === 1 ? "time das ligas cadastradas está" : "times das ligas cadastradas estão"} sem escudo. A busca usa uma consulta da API-Football por liga e leva alguns segundos entre elas.`
          : "Todos os times das ligas cadastradas já têm escudo."}{" "}
        Os que não forem achados podem ser buscados um a um, no botão de escudo
        de cada time.
      </p>
      {hasKey ? (
        missing > 0 && (
          <div>
            <button type="button" className="btn btn-primary" disabled={running} onClick={run}>
              {running ? "Buscando escudos..." : "Buscar escudos das ligas"}
            </button>
          </div>
        )
      ) : (
        <p className="text-body text-danger">
          Falta configurar a chave da API-Football (API_FOOTBALL_KEY). Veja o README.
        </p>
      )}
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-body" aria-live="polite">
          {lines.map((l) => (
            <li
              key={l.league}
              className={
                l.tone === "error" ? "text-danger" : l.tone === "warn" ? "text-muted" : undefined
              }
            >
              <span className="font-black">{l.league}:</span> {l.text}
              {l.missing && l.missing.length > 0 && (
                <details className="inline">
                  <summary className="inline cursor-pointer">
                    {" "}
                    · {l.missing.length} sem achar
                  </summary>
                  <span className="block text-muted">{l.missing.join(", ")}</span>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

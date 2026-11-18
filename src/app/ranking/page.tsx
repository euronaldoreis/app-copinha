import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { RankPodium } from "@/components/RankPodium";
import { Empty, PageTitle } from "@/components/ui";
import { getData } from "@/lib/data";
import { plural, resultLabel } from "@/lib/labels";
import {
  RANK_FILTERS,
  eligible,
  rankFilter,
  sortByFilter,
} from "@/lib/ranking";
import {
  computeRanking,
  computeRecords,
  computeTeamRanking,
  type MatchRecord,
  type PlayerStats,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Ranking" };

// Os seis filtros do ranking de jogadores, depois as duas visões à parte.
const TABS = [
  ...RANK_FILTERS.map((f) => ({ id: String(f.id), label: f.label })),
  { id: "times", label: "Times" },
  { id: "recordes", label: "Recordes" },
];

interface Column {
  /** Filtro que esta coluna mede (ela fica em destaque quando ele está ativo). */
  key?: string;
  head: string;
  title: string;
  value: (r: PlayerStats) => ReactNode;
  /** Some no celular para a tabela caber. */
  wide?: boolean;
  strong?: boolean;
}

const TITLE_COLUMNS: Column[] = [
  { key: "titulos", head: "Tit.", title: "Títulos", value: (r) => r.titles },
  {
    key: "finais",
    head: "Fin.",
    title: "Finais disputadas",
    value: (r) => r.finals,
  },
  {
    head: "Pod.",
    title: "Pódios (1º, 2º ou 3º)",
    value: (r) => r.podiums,
    wide: true,
  },
  {
    head: "Semi",
    title: "Vezes entre os 4 melhores",
    value: (r) => r.top4,
    wide: true,
  },
  {
    key: "participacoes",
    head: "Part.",
    title: "Participações",
    value: (r) => r.participations,
  },
];

const signed = (n: number) => (n > 0 ? `+${n}` : n);

const GAME_COLUMNS: Column[] = [
  {
    key: "pontos",
    head: "Pts",
    title: "Pontos (vitória 3, empate 1)",
    value: (r) => r.points,
  },
  { head: "%", title: "Aproveitamento", value: (r) => `${r.pct}%` },
  { head: "J", title: "Jogos", value: (r) => r.played },
  { key: "vitorias", head: "V", title: "Vitórias", value: (r) => r.wins },
  { head: "E", title: "Empates", value: (r) => r.draws, wide: true },
  { head: "D", title: "Derrotas", value: (r) => r.losses, wide: true },
  { key: "gols", head: "GP", title: "Gols pró", value: (r) => r.gf },
  { head: "GC", title: "Gols contra", value: (r) => r.ga, wide: true },
  { head: "SG", title: "Saldo de gols", value: (r) => signed(r.gd) },
];

function RankTable({
  rows,
  columns,
  detail,
}: {
  rows: PlayerStats[];
  columns: Column[];
  detail: (r: PlayerStats) => string;
}) {
  const hide = (c: Column) => (c.wide ? "hidden sm:table-cell" : "");
  return (
    <div className="card px-3 pb-2 pt-3">
      <table className="w-full text-body">
        <thead className="text-muted">
          <tr>
            <th className="w-12 pb-2 text-left font-normal">
              <span className="sr-only">Posição</span>
            </th>
            <th className="pb-2 text-left font-normal">Jogador</th>
            {columns.map((c) => (
              <th
                key={c.head}
                title={c.title}
                className={`px-1.5 pb-2 text-right font-normal ${hide(c)}`}
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.player.id} className="h-[68px]">
              <td className="num pl-4 pr-3 text-muted">{i + 1}</td>
              <td className="w-full max-w-0">
                <Link
                  href={`/jogadores/${r.player.id}`}
                  className="flex items-center gap-3"
                >
                  {/* No celular o retrato sai para o nome caber inteiro. */}
                  <span className="hidden sm:block">
                    <Avatar
                      name={r.player.name}
                      photoUrl={r.player.photoUrl}
                      avatar={r.player.avatar}
                      size={40}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-name font-semibold">
                      {r.player.name}
                    </span>
                    <span className="block truncate text-muted">
                      {detail(r)}
                    </span>
                  </span>
                </Link>
              </td>
              {columns.map((c) => (
                <td
                  key={c.head}
                  className={`num px-1.5 text-right ${hide(c)} ${
                    c.strong ? "text-name font-semibold" : ""
                  }`}
                >
                  {c.value(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ columns, note }: { columns: Column[]; note?: string }) {
  return (
    <p className="mt-3 px-1 text-body text-muted">
      {columns.map((c, i) => (
        <span key={c.head} className={c.wide ? "hidden sm:inline" : ""}>
          {i > 0 && " · "}
          {c.head} {c.title.toLowerCase()}
        </span>
      ))}
      {note && `. ${note}.`}
    </p>
  );
}

function RecordCard({
  label,
  children,
  detail,
}: {
  label: string;
  children: ReactNode;
  detail: string;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-body text-muted">{label}</p>
      <p className="mt-1 text-name font-semibold">{children}</p>
      <p className="text-body text-muted">{detail}</p>
    </div>
  );
}

function scoreLine(m: MatchRecord) {
  return (
    <>
      {m.home.name}{" "}
      <span className="num">
        {m.homeScore} – {m.awayScore}
      </span>{" "}
      {m.away.name}
    </>
  );
}

function matchDetail(m: MatchRecord) {
  const teams =
    m.homeTeam && m.awayTeam ? `${m.homeTeam} × ${m.awayTeam} · ` : "";
  return `${teams}${m.edition.name}`;
}

export default async function RankingPage(props: PageProps<"/ranking">) {
  const { aba } = await props.searchParams;
  // "jogos" era o nome antigo da aba de pontos: links salvos continuam valendo.
  const wanted = aba === "jogos" ? "pontos" : aba;
  const tab = TABS.find((t) => t.id === wanted)?.id ?? "titulos";
  const data = await getData();
  const ranking = computeRanking(data).filter((r) => r.participations > 0);
  const filter = rankFilter(tab);

  let podium: ReactNode = null;
  let content: ReactNode;
  if (ranking.length === 0) {
    content = (
      <Empty>O ranking aparece quando a primeira edição começar.</Empty>
    );
  } else if (filter) {
    const rows = sortByFilter(filter.id, eligible(filter, ranking));
    // Pódio: os três primeiros que realmente têm o que o filtro mede.
    const top = rows
      .filter((r) => filter.value(r) > 0)
      .slice(0, 3)
      .map((r) => ({
        playerId: r.player.id,
        name: r.player.name,
        photoUrl: r.player.photoUrl,
        avatar: r.player.avatar,
        value: filter.describe(filter.value(r)),
      }));
    if (top.length > 0) podium = <RankPodium top={top} />;

    const gameFilter = filter.needsGames;
    const columns = (gameFilter ? GAME_COLUMNS : TITLE_COLUMNS).map((c) => ({
      ...c,
      // A coluna do filtro escolhido sempre aparece (inclusive no celular) e em destaque.
      strong: c.key === filter.id,
      wide: c.key === filter.id ? false : c.wide,
    }));
    content = rows.length ? (
      <>
        <RankTable
          rows={rows}
          columns={columns}
          detail={(r) =>
            gameFilter
              ? `${r.wins}V ${r.draws}E ${r.losses}D`
              : r.bestResult
                ? resultLabel(r.bestResult)
                : "Estreante"
          }
        />
        <Legend
          columns={columns}
          note={
            filter.id === "pontos"
              ? "Pontuação geral: vitória vale 3 pontos e empate 1. Desempate por aproveitamento, saldo de gols e gols marcados. Jogo decidido nos pênaltis conta como empate"
              : gameFilter
                ? "Jogo decidido nos pênaltis conta como empate"
                : undefined
          }
        />
      </>
    ) : (
      <Empty>Nenhum placar lançado ainda.</Empty>
    );
  } else if (tab === "times") {
    const teams = computeTeamRanking(data);
    content = teams.length ? (
      <div className="card px-5 py-1.5">
        {teams.map((t) => (
          <div
            key={t.team.id}
            className="flex min-h-[68px] items-center gap-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-name font-semibold">
                {t.team.name}
              </span>
              <span className="block truncate text-body text-muted">
                {[
                  `Sorteado ${plural(t.uses, "vez", "vezes")}`,
                  t.champions.length
                    ? `campeão com ${t.champions.join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {t.titles > 0 && (
              <span className="num text-name font-semibold text-accent">
                {plural(t.titles, "título", "títulos")}
              </span>
            )}
          </div>
        ))}
      </div>
    ) : (
      <Empty>Nenhum time sorteado ainda.</Empty>
    );
  } else {
    const records = computeRecords(data);
    const {
      biggestWin,
      mostGoals,
      bestAttack,
      rivalry,
      unbeatenRun,
      unbeatenChampions,
      worstCampaign,
      penaltyKing,
    } = records;
    const span = (
      from: { name: string; id: number },
      to: { name: string; id: number },
    ) =>
      from.id === to.id ? `Na ${from.name}` : `De ${from.name} a ${to.name}`;
    const any =
      biggestWin ||
      mostGoals ||
      bestAttack ||
      rivalry ||
      unbeatenRun ||
      unbeatenChampions.length > 0 ||
      worstCampaign ||
      penaltyKing;
    content = any ? (
      <div className="grid grid-cols-1 gap-3">
        {biggestWin && (
          <RecordCard label="Maior goleada" detail={matchDetail(biggestWin)}>
            {scoreLine(biggestWin)}
          </RecordCard>
        )}
        {mostGoals && (
          <RecordCard
            label="Jogo com mais gols"
            detail={matchDetail(mostGoals)}
          >
            {scoreLine(mostGoals)}
          </RecordCard>
        )}
        {bestAttack && (
          <RecordCard
            label="Melhor ataque em uma edição"
            detail={bestAttack.edition.name}
          >
            {bestAttack.player.name},{" "}
            <span className="num">
              {plural(bestAttack.goals, "gol", "gols")}
            </span>
          </RecordCard>
        )}
        {rivalry && (
          <RecordCard
            label="Maior freguesia"
            detail={`Vitórias no confronto direto · ${plural(
              rivalry.wins + rivalry.losses + rivalry.draws,
              "jogo",
              "jogos",
            )}${rivalry.draws ? `, ${plural(rivalry.draws, "empate", "empates")}` : ""}`}
          >
            {rivalry.winner.name}{" "}
            <span className="num">
              {rivalry.wins} – {rivalry.losses}
            </span>{" "}
            {rivalry.loser.name}
          </RecordCard>
        )}
        {unbeatenRun && (
          <RecordCard
            label="Maior sequência invicta"
            detail={span(unbeatenRun.from, unbeatenRun.to)}
          >
            {unbeatenRun.player.name},{" "}
            <span className="num">{unbeatenRun.games}</span> jogos sem perder
          </RecordCard>
        )}
        {unbeatenChampions.length > 0 && (
          <RecordCard
            label={
              unbeatenChampions.length > 1
                ? "Campeões invictos"
                : "Campeão invicto"
            }
            detail="Levantaram a taça sem perder nenhum jogo"
          >
            {unbeatenChampions.slice(0, 5).map((c) => (
              <span key={c.edition.id} className="block">
                {c.player.name}{" "}
                <span className="text-body font-normal text-muted">
                  · {c.edition.name} ·{" "}
                  <span className="num">
                    {c.wins}V {c.draws}E
                  </span>
                </span>
              </span>
            ))}
            {unbeatenChampions.length > 5 && (
              <span className="block text-body font-normal text-muted">
                e mais {unbeatenChampions.length - 5}
              </span>
            )}
          </RecordCard>
        )}
        {penaltyKing && (
          <RecordCard
            label="Rei dos pênaltis"
            detail={`Venceu ${penaltyKing.won} de ${plural(
              penaltyKing.total,
              "disputa",
              "disputas",
            )}`}
          >
            {penaltyKing.player.name},{" "}
            <span className="num">
              {plural(penaltyKing.won, "disputa vencida", "disputas vencidas")}
            </span>
          </RecordCard>
        )}
        {worstCampaign && (
          <RecordCard
            label="Lixo do lixo: pior campanha"
            detail={`${worstCampaign.edition.name} · ${plural(
              worstCampaign.played,
              "jogo",
              "jogos",
            )}, ${plural(worstCampaign.gf, "gol pró", "gols pró")} e ${worstCampaign.ga} contra`}
          >
            {worstCampaign.player.name},{" "}
            <span className="num">
              {plural(worstCampaign.points, "ponto", "pontos")}
            </span>
          </RecordCard>
        )}
      </div>
    ) : (
      <Empty>Os recordes aparecem depois dos primeiros placares.</Empty>
    );
  }

  return (
    <>
      <PageTitle title="Ranking" />
      {podium}
      <nav
        aria-label="Filtros do ranking"
        className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {TABS.map((t) => (
          <Link
            // A chave muda com o estado: o botão é recriado (e repintado
            // inteiro) quando entra ou sai de ativo.
            key={`${t.id}:${tab === t.id}`}
            href={t.id === "titulos" ? "/ranking" : `/ranking?aba=${t.id}`}
            className="chip"
            aria-current={tab === t.id ? "page" : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}

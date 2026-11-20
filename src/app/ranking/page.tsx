import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { LeaderRow } from "@/components/Leaderboard";
import { TeamShield } from "@/components/TeamShield";
import {
  BallIcon,
  CalendarIcon,
  ChartIcon,
  StarIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { currentPlayerId } from "@/lib/auth";
import { tierOf } from "@/lib/tier";
import { RankPodium } from "@/components/RankPodium";
import { Empty, PageTitle } from "@/components/ui";
import { getData } from "@/lib/data";
import { plural, resultLabel } from "@/lib/labels";
import type { RankFilter } from "@/lib/ranking";
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
  type PlayerStats,
} from "@/lib/stats";
import { RankingList } from "@/components/RankingList";
import { RecordsBoard } from "@/components/RecordsBoard";
import { recordItems } from "@/lib/recordItems";

export const metadata: Metadata = { title: "Ranking" };

/** Botões de critério do ranking de jogadores: nome curto, ícone e unidade. */
const METRICS: Record<
  RankFilter,
  {
    short: string;
    unit: [string, string];
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  titulos: { short: "Títulos", unit: ["título", "títulos"], icon: TrophyIcon },
  finais: { short: "Finais", unit: ["final", "finais"], icon: StarIcon },
  participacoes: {
    short: "Edições",
    unit: ["edição", "edições"],
    icon: CalendarIcon,
  },
  vitorias: {
    short: "Vitórias",
    unit: ["vitória", "vitórias"],
    icon: SwordsIcon,
  },
  gols: { short: "Gols", unit: ["gol", "gols"], icon: BallIcon },
  pontos: { short: "Pontos", unit: ["ponto", "pontos"], icon: ChartIcon },
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Resumo embaixo do nome, conforme o critério. */
function summary(filter: RankFilter, r: PlayerStats) {
  switch (filter) {
    case "titulos":
      return [
        r.finals ? plural(r.finals, "final", "finais") : "",
        r.podiums ? plural(r.podiums, "pódio", "pódios") : "",
        plural(r.participations, "edição", "edições"),
      ]
        .filter(Boolean)
        .join(" · ");
    case "finais":
      return `${plural(r.titles, "título", "títulos")} · ${plural(r.participations, "edição", "edições")}`;
    case "participacoes":
      return r.bestResult
        ? `Melhor: ${resultLabel(r.bestResult)}`
        : "Estreante";
    case "gols":
      return `${plural(r.played, "jogo", "jogos")} · saldo ${signed(r.gd)}`;
    default:
      return `${r.wins}V ${r.draws}E ${r.losses}D · ${r.pct ?? 0}% · SG ${signed(r.gd)}`;
  }
}

const NOTES: Partial<Record<RankFilter, string>> = {
  pontos:
    "Vitória vale 3 pontos e empate 1. Desempate por aproveitamento, saldo e gols marcados. Jogo decidido nos pênaltis conta como empate.",
  vitorias: "Jogo decidido nos pênaltis conta como empate.",
  gols: "Gols marcados em todos os jogos, sem contar os pênaltis.",
  titulos: "Desempate por finais, pódios, semifinais e participações.",
};

export default async function RankingPage(props: PageProps<"/ranking">) {
  const { aba } = await props.searchParams;
  // "jogos" era o nome antigo da aba de pontos: links salvos continuam valendo.
  const raw = Array.isArray(aba) ? aba[0] : aba;
  const wanted = raw === "jogos" ? "pontos" : raw;
  const filter =
    wanted === "times" || wanted === "recordes"
      ? undefined
      : (rankFilter(wanted) ?? rankFilter("titulos")!);
  const view = filter ? "jogadores" : (wanted as "times" | "recordes");
  const [data, myId] = await Promise.all([getData(), currentPlayerId()]);
  const ranking = computeRanking(data).filter((r) => r.participations > 0);

  let header: ReactNode = null;
  let content: ReactNode;
  if (view === "jogadores" && filter) {
    const metric = METRICS[filter.id];
    header = (
      <nav aria-label="Critério do ranking" className="metric-grid mb-6">
        {RANK_FILTERS.map((f) => {
          const m = METRICS[f.id];
          const Icon = m.icon;
          const on = f.id === filter.id;
          return (
            <Link
              key={`${f.id}:${on}`}
              href={f.id === "titulos" ? "/ranking" : `/ranking?aba=${f.id}`}
              className="metric-tile"
              aria-current={on ? "page" : undefined}
              scroll={false}
            >
              <Icon width={22} height={22} />
              {m.short}
            </Link>
          );
        })}
      </nav>
    );

    if (ranking.length === 0) {
      content = (
        <Empty>O ranking aparece quando a primeira edição começar.</Empty>
      );
    } else {
      const rows = sortByFilter(filter.id, eligible(filter, ranking));
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
      content = rows.length ? (
        <>
          {top.length > 0 && <RankPodium key={filter.id} top={top} />}
          <RankingList
            key={`lista-${filter.id}`}
            rows={rows.map((r) => {
              const v = filter.value(r);
              return {
                id: r.player.id,
                name: r.player.name,
                photoUrl: r.player.photoUrl,
                avatar: r.player.avatar,
                tier: tierOf(r.bestResult, r.titles),
                sub: summary(filter.id, r),
                value: v,
                unit: v === 1 ? metric.unit[0] : metric.unit[1],
                me: myId === r.player.id,
                numbers: {
                  titles: r.titles,
                  vices: r.vices,
                  thirds: r.thirds,
                  finals: r.finals,
                  podiums: r.podiums,
                  participations: r.participations,
                  played: r.played,
                  wins: r.wins,
                  draws: r.draws,
                  losses: r.losses,
                  points: r.points,
                  pct: r.pct,
                  gf: r.gf,
                  ga: r.ga,
                  gd: r.gd,
                  best: r.bestResult ? resultLabel(r.bestResult) : null,
                },
              };
            })}
          />
          {NOTES[filter.id] && (
            <p className="mt-4 px-1 text-body text-muted">{NOTES[filter.id]}</p>
          )}
        </>
      ) : (
        <Empty>Nenhum placar lançado ainda.</Empty>
      );
    }
  } else if (view === "times") {
    const teams = computeTeamRanking(data);
    content = teams.length ? (
      <div className="lb-list">
        {teams.map((t, i) => (
          <LeaderRow
            key={t.team.id}
            index={i}
            place={i + 1}
            media={<TeamShield team={t.team.name} size={40} />}
            name={t.team.name}
            sub={
              t.champions.length
                ? `Campeão com ${t.champions.join(", ")}`
                : `Sorteado ${plural(t.uses, "vez", "vezes")}`
            }
            value={<span className="num">{t.titles}</span>}
            unit={t.titles === 1 ? "título" : "títulos"}
          />
        ))}
      </div>
    ) : (
      <Empty>Nenhum time sorteado ainda.</Empty>
    );
  } else {
    const items = recordItems(computeRecords(data));
    content = items.length ? (
      <RecordsBoard items={items} />
    ) : (
      <Empty>Os recordes aparecem depois dos primeiros placares.</Empty>
    );
  }

  const VIEWS = [
    { id: "jogadores", label: "Jogadores", href: "/ranking" },
    { id: "times", label: "Times", href: "/ranking?aba=times" },
    { id: "recordes", label: "Recordes", href: "/ranking?aba=recordes" },
  ];

  return (
    <>
      <PageTitle title="Ranking" />
      <nav aria-label="O que ver no ranking" className="rank-tabs mb-4">
        {VIEWS.map((v) => (
          <Link
            key={`${v.id}:${view === v.id}`}
            href={v.href}
            className="rank-tab"
            aria-current={view === v.id ? "page" : undefined}
            scroll={false}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {header}
      {content}
    </>
  );
}

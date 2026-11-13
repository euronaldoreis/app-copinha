import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Empty, PageTitle } from "@/components/ui";
import { getData } from "@/lib/data";
import { plural, resultLabel } from "@/lib/labels";
import {
  computeRanking,
  computeRecords,
  computeTeamRanking,
  type MatchRecord,
  type PlayerStats,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Ranking" };

const TABS = [
  { id: "titulos", label: "Títulos" },
  { id: "jogos", label: "Jogos" },
  { id: "times", label: "Times" },
  { id: "recordes", label: "Recordes" },
];

interface Column {
  head: string;
  title: string;
  value: (r: PlayerStats) => ReactNode;
  /** Some no celular para a tabela caber. */
  wide?: boolean;
  strong?: boolean;
}

const TITLE_COLUMNS: Column[] = [
  { head: "Tit.", title: "Títulos", value: (r) => r.titles, strong: true },
  { head: "Fin.", title: "Finais disputadas", value: (r) => r.finals },
  { head: "Pod.", title: "Pódios (1º, 2º ou 3º)", value: (r) => r.podiums, wide: true },
  { head: "Semi", title: "Vezes entre os 4 melhores", value: (r) => r.top4, wide: true },
  { head: "Part.", title: "Participações", value: (r) => r.participations },
];

const signed = (n: number) => (n > 0 ? `+${n}` : n);

const GAME_COLUMNS: Column[] = [
  { head: "%", title: "Aproveitamento", value: (r) => `${r.pct}%`, strong: true },
  { head: "J", title: "Jogos", value: (r) => r.played },
  { head: "V", title: "Vitórias", value: (r) => r.wins, wide: true },
  { head: "E", title: "Empates", value: (r) => r.draws, wide: true },
  { head: "D", title: "Derrotas", value: (r) => r.losses, wide: true },
  { head: "GP", title: "Gols pró", value: (r) => r.gf, wide: true },
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
    <div className="card px-5 pb-2 pt-4">
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
                    <Avatar name={r.player.name} photoUrl={r.player.photoUrl} size={40} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-name font-semibold">
                      {r.player.name}
                    </span>
                    <span className="block truncate text-muted">{detail(r)}</span>
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
  const tab = TABS.find((t) => t.id === aba)?.id ?? "titulos";
  const data = await getData();
  const ranking = computeRanking(data).filter((r) => r.participations > 0);

  let content: ReactNode;
  if (ranking.length === 0) {
    content = <Empty>O ranking aparece quando a primeira edição começar.</Empty>;
  } else if (tab === "titulos") {
    content = (
      <>
        <RankTable
          rows={ranking}
          columns={TITLE_COLUMNS}
          detail={(r) =>
            r.bestResult ? resultLabel(r.bestResult) : "Estreante"
          }
        />
        <Legend columns={TITLE_COLUMNS} />
      </>
    );
  } else if (tab === "jogos") {
    const rows = ranking
      .filter((r) => r.played > 0)
      .sort(
        (a, b) =>
          (b.pct ?? 0) - (a.pct ?? 0) || b.played - a.played || b.gd - a.gd,
      );
    content = rows.length ? (
      <>
        <RankTable
          rows={rows}
          columns={GAME_COLUMNS}
          detail={(r) => `${r.wins}V ${r.draws}E ${r.losses}D`}
        />
        <Legend
          columns={GAME_COLUMNS}
          note="Jogo decidido nos pênaltis conta como empate"
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
          <div key={t.team.id} className="flex min-h-[68px] items-center gap-3.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-name font-semibold">
                {t.team.name}
              </span>
              <span className="block truncate text-body text-muted">
                {[
                  `Sorteado ${plural(t.uses, "vez", "vezes")}`,
                  t.champions.length ? `campeão com ${t.champions.join(", ")}` : "",
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
    content =
      records.biggestWin || records.mostGoals || records.bestAttack ? (
        <div className="grid grid-cols-1 gap-3">
          {records.biggestWin && (
            <RecordCard label="Maior goleada" detail={matchDetail(records.biggestWin)}>
              {scoreLine(records.biggestWin)}
            </RecordCard>
          )}
          {records.mostGoals && (
            <RecordCard label="Jogo com mais gols" detail={matchDetail(records.mostGoals)}>
              {scoreLine(records.mostGoals)}
            </RecordCard>
          )}
          {records.bestAttack && (
            <RecordCard
              label="Melhor ataque em uma edição"
              detail={records.bestAttack.edition.name}
            >
              {records.bestAttack.player.name},{" "}
              <span className="num">{plural(records.bestAttack.goals, "gol", "gols")}</span>
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
      <nav aria-label="Seções do ranking" className="-mx-1 -mt-3 mb-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.id}
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

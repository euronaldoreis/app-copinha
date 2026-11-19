import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChampionParty,
  PartyButton,
  type PartyPerson,
} from "@/components/ChampionParty";
import { DrawPanel } from "@/components/DrawPanel";
import { EntryControls } from "@/components/EntryControls";
import { StartPanel } from "@/components/GroupDraw";
import { Tabs, type TabItem } from "@/components/Tabs";
import { MatchCard, type MatchSide } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import {
  PeopleIcon,
  SettingsIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { Empty, PageTitle, Section } from "@/components/ui";
import { LeaderRow, PlayerMedia } from "@/components/Leaderboard";
import { TeamShield } from "@/components/TeamShield";
import type { Match } from "@/db/schema";
import { currentPlayerId, isAdmin } from "@/lib/auth";
import { tierOf } from "@/lib/tier";
import { computeRanking } from "@/lib/stats";
import { getData } from "@/lib/data";
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  formatDate,
  pairingNote,
  plural,
  resultLabel,
  resultRank,
  roundLabel,
  sourceLabel,
} from "@/lib/labels";
import { ChampionPanel } from "@/components/ChampionPanel";
import { configOf, editionView, type EditionView } from "@/lib/services";
import {
  knockoutRounds,
  standingsByGroup,
  validateConfig,
  type Format,
} from "@/lib/tournament";

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  const data = await getData();
  const view = /^\d+$/.test(id) ? editionView(data, Number(id)) : null;
  return { data, view };
}

export async function generateMetadata(
  props: PageProps<"/edicoes/[id]">,
): Promise<Metadata> {
  const { view } = await load(props.params);
  return { title: view?.edition.name ?? "Edição" };
}

// ---------------------------------------------------------------------------

function Podium({ view }: { view: EditionView }) {
  const by = (code: string) => view.entries.find((e) => e.result === code);
  const champion = by("campeao");
  if (!champion) return null;
  const third = by("terceiro");
  return (
    <div className="anim-pop card flex flex-col gap-2 p-3.5">
      <Link
        href={`/jogadores/${champion.playerId}`}
        aria-label={`Campeão: ${champion.player.name}`}
        className="block"
      >
        <ChampionPanel champion={champion} vice={by("vice")} />
      </Link>
      {third && (
        <p className="px-1 text-body text-muted">
          3º lugar:{" "}
          <Link
            href={`/jogadores/${third.playerId}`}
            className="font-black text-ink"
          >
            {third.player.name}
          </Link>
          {third.team && ` · ${third.team.name}`}
        </p>
      )}
      <div className="-mb-1 -ml-2">
        <PartyButton />
      </div>
    </div>
  );
}

function MatchList({
  matches,
  view,
  admin,
  totalRounds,
  numbers,
  label,
}: {
  matches: Match[];
  view: EditionView;
  admin: boolean;
  totalRounds: number;
  /** Número de cada jogo na edição, pelo id. */
  numbers: Map<number, number>;
  /** Fase mostrada na faixa de cada cartão. */
  label: (m: Match) => string;
}) {
  const entryById = new Map(view.entries.map((e) => [e.id, e]));
  const side = (entryId: number | null): MatchSide | null => {
    const e = entryId != null ? entryById.get(entryId) : null;
    return e
      ? {
          playerId: e.playerId,
          name: e.player.name,
          team: view.edition.useTeams ? (e.team?.name ?? null) : null,
          photoUrl: e.player.photoUrl,
          avatar: e.player.avatar,
        }
      : null;
  };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {matches.map((m, i) => (
        <div
          key={m.id}
          className="anim-pop"
          style={{ "--i": Math.min(i, 10) } as CSSProperties}
        >
          <MatchCard
            matchId={m.id}
            number={numbers.get(m.id) ?? 0}
            label={label(m)}
            knockout={m.stage !== "grupo"}
            home={side(m.homeEntryId)}
            away={side(m.awayEntryId)}
            homePlaceholder={sourceLabel(
              m.homeSource,
              view.edition.format,
              totalRounds,
            )}
            awayPlaceholder={sourceLabel(
              m.awaySource,
              view.edition.format,
              totalRounds,
            )}
            homeScore={m.homeScore}
            awayScore={m.awayScore}
            homePens={m.homePens}
            awayPens={m.awayPens}
            admin={admin}
          />
        </div>
      ))}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-body text-muted">{children}</h3>;
}

function Tournament({
  view,
  admin,
  tiers,
}: {
  view: EditionView;
  admin: boolean;
  /** Categoria de cada jogador (moldura do retrato). */
  tiers: Map<number, string>;
}) {
  const { edition, entries, matches } = view;
  const totalRounds = knockoutRounds(matches);
  const groupMatches = matches.filter((m) => m.stage === "grupo");
  const knockout = matches.filter((m) => m.stage !== "grupo");
  const tables = groupMatches.length ? standingsByGroup(entries, matches) : [];
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const full = tables.length
    ? Math.floor(edition.qualifiers / tables.length)
    : 0;
  const extra = tables.length ? edition.qualifiers % tables.length : 0;
  const ordinal = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto"];
  let rule = "";
  if (edition.qualifiers === 0) rule = "O líder é o campeão";
  else if (tables.length === 1)
    rule = `Avançam os ${edition.qualifiers} primeiros`;
  else {
    rule =
      full === 1
        ? "Avança o primeiro de cada grupo"
        : `Avançam os ${full} primeiros de cada grupo`;
    if (extra)
      rule += ` e ${extra === 1 ? "o melhor" : `os ${extra} melhores`} ${
        ordinal[full + 1] ?? `${full + 1}º`
      }${extra === 1 ? "" : "s"}`;
  }

  // Mata-mata em ordem cronológica: fases, depois 3º lugar, depois a final.
  const stages: { label: string; matches: Match[] }[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    if (r === totalRounds) {
      const third = knockout.filter((m) => m.stage === "terceiro");
      if (third.length)
        stages.push({ label: "Disputa de 3º lugar", matches: third });
    }
    const ms = knockout.filter((m) => m.stage === "mata" && m.round === r);
    if (ms.length)
      stages.push({ label: roundLabel(r, totalRounds), matches: ms });
  }

  const rounds = [...new Set(groupMatches.map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  const roundMatches = (round: number) =>
    groupMatches
      .filter((m) => m.round === round)
      .sort(
        (a, b) =>
          (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") ||
          a.slot - b.slot,
      );

  // Numeração dos jogos na ordem em que acontecem: rodadas e depois o mata-mata.
  const numbers = new Map<number, number>();
  for (const m of [
    ...rounds.flatMap(roundMatches),
    ...stages.flatMap((s) => [...s.matches].sort((a, b) => a.slot - b.slot)),
  ])
    numbers.set(m.id, numbers.size + 1);

  const groupLabel = (m: Match) =>
    edition.format === "liga" || !m.groupLabel || tables.length <= 1
      ? `Rodada ${m.round}`
      : `Grupo ${m.groupLabel}`;
  const stageLabel = (label: string) => () => label;

  // Regra curta na faixa de cada grupo.
  const advancing = edition.qualifiers === 0 ? 1 : full;
  const groupNote =
    edition.qualifiers === 0
      ? "O líder é campeão"
      : advancing === 1
        ? "O 1º avança"
        : advancing > 1
          ? `Os ${advancing} primeiros avançam`
          : undefined;

  const tabs: TabItem[] = [];

  if (tables.length > 0) {
    tabs.push({
      id: "grupos",
      label: edition.format === "liga" ? "Classificação" : "Grupos",
      icon: <PeopleIcon width={18} height={18} />,
      content: (
        <>
          <p className="mb-4 text-body text-muted">{rule}</p>
          <div className="grid grid-cols-1 gap-4">
            {tables.map((t) => (
              <StandingsTable
                key={t.label}
                title={tables.length > 1 ? `Grupo ${t.label}` : "Classificação"}
                note={groupNote}
                rows={t.rows}
                entries={entryById}
                qualifying={edition.qualifiers === 0 ? 1 : full}
                tiers={tiers}
              />
            ))}
          </div>
        </>
      ),
    });
  }

  if (stages.length > 0) {
    tabs.push({
      id: "mata",
      label: "Mata-mata",
      icon: <TrophyIcon width={18} height={18} />,
      content: (
        <>
          {stages.map((s) => (
            <div key={s.label} className="mt-5 first:mt-0">
              <SubHeading>{s.label}</SubHeading>
              <MatchList
                matches={s.matches}
                view={view}
                admin={admin}
                totalRounds={totalRounds}
                numbers={numbers}
                label={stageLabel(s.label)}
              />
            </div>
          ))}
        </>
      ),
    });
  }

  if (rounds.length > 0) {
    tabs.push({
      id: "jogos",
      label: "Jogos",
      icon: <SwordsIcon width={22} height={22} />,
      content: (
        <>
          {edition.format === "grupos" && edition.pairing !== "interno" && (
            <p className="mb-4 text-body text-muted">
              {pairingNote(edition.pairing, edition.crossGames)}
            </p>
          )}
          {rounds.map((round) => (
            <div key={round} className="mt-5 first:mt-0">
              <SubHeading>Rodada {round}</SubHeading>
              <MatchList
                matches={roundMatches(round)}
                view={view}
                admin={admin}
                totalRounds={totalRounds}
                numbers={numbers}
                label={groupLabel}
              />
            </div>
          ))}
        </>
      ),
    });
  }

  // Ordem das abas: jogos, grupos (ou classificação) e mata-mata.
  const tabOrder = ["jogos", "grupos", "mata"];
  tabs.sort((a, b) => tabOrder.indexOf(a.id) - tabOrder.indexOf(b.id));

  // Abre direto no mata-mata quando a fase de grupos já acabou.
  const groupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => m.homeScore != null);
  const initial = groupsDone && stages.length > 0 ? "mata" : undefined;

  if (tabs.length === 0) return null;
  // Uma só parte (ex.: mata-mata puro): não precisa de abas.
  if (tabs.length === 1) return <div className="mt-10">{tabs[0].content}</div>;
  return <Tabs tabs={tabs} initial={initial} />;
}

function Participants({
  view,
  admin,
  editable,
  knownTeams = [],
  tiers,
  myId,
}: {
  view: EditionView;
  admin: boolean;
  editable: boolean;
  /** Categoria de cada jogador (moldura do retrato). */
  tiers: Map<number, string>;
  /** Jogador com sessão (aparece como "Você"). */
  myId: number | null;
  /** Times já cadastrados, para o auto complete do campo de time. */
  knownTeams?: string[];
}) {
  const manual = view.edition.format === "manual";
  const list = manual
    ? [...view.entries].sort(
        (a, b) =>
          resultRank(a.result) - resultRank(b.result) ||
          a.player.name.localeCompare(b.player.name, "pt-BR"),
      )
    : [...view.entries].sort((a, b) =>
        a.player.name.localeCompare(b.player.name, "pt-BR"),
      );
  if (list.length === 0) {
    return <Empty>Ninguém inscrito ainda.</Empty>;
  }
  return (
    <div className="lb-list">
      {list.map((e, i) => {
        const controls = admin && editable && (
          <EntryControls
            // recria o estado quando o time ou a colocação mudam no servidor
            key={`${e.id}:${e.teamId}:${e.result}`}
            entryId={e.id}
            playerName={e.player.name}
            team={e.team?.name ?? null}
            result={e.result}
            manual={manual}
            useTeams={view.edition.useTeams}
            knownTeams={knownTeams}
            takenTeams={view.entries
              .filter((x) => x.id !== e.id && x.team)
              .map((x) => x.team!.name)}
          />
        );
        return (
          <LeaderRow
            key={e.id}
            index={i}
            href={`/jogadores/${e.playerId}`}
            me={myId === e.playerId}
            media={
              <PlayerMedia
                name={e.player.name}
                photoUrl={e.player.photoUrl}
                avatar={e.player.avatar}
                tier={tiers.get(e.playerId) ?? "participou"}
              />
            }
            name={e.player.name}
            sub={[
              view.edition.useTeams ? (e.team?.name ?? "Sem time") : "",
              e.groupLabel ? `Grupo ${e.groupLabel}` : "",
              manual ? resultLabel(e.result) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              view.edition.useTeams && e.team && !controls ? (
                <TeamShield team={e.team.name} size={34} />
              ) : undefined
            }
          >
            {controls || undefined}
          </LeaderRow>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default async function EditionPage(props: PageProps<"/edicoes/[id]">) {
  const [{ data, view }, admin, myId] = await Promise.all([
    load(props.params),
    isAdmin(),
    currentPlayerId(),
  ]);
  if (!view) notFound();
  const tiers = new Map(
    computeRanking(data).map((r) => [
      r.player.id,
      tierOf(r.bestResult, r.titles),
    ]),
  );
  const { edition, entries, matches } = view;
  const format = edition.format as Format;
  const manual = format === "manual";
  const setup = edition.status === "inscricoes";

  const played = matches.filter((m) => m.homeScore != null).length;
  const subtitle = [
    edition.game,
    formatDate(edition.playedOn),
    FORMAT_LABELS[format],
    manual ? "" : STATUS_LABELS[edition.status],
    matches.length
      ? `${played} de ${plural(matches.length, "jogo", "jogos")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const partyPerson = (result: string): PartyPerson | null => {
    const e = entries.find((entry) => entry.result === result);
    return e
      ? {
          entryId: e.id,
          name: e.player.name,
          avatar: e.player.avatar,
          team: e.team?.name ?? null,
        }
      : null;
  };

  const withoutTeam = entries.filter((e) => e.teamId == null).length;
  const configProblem = setup
    ? validateConfig(configOf(edition), entries.length)
    : null;
  const knownTeams = [
    ...new Set([...edition.teamPool, ...data.teams.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <PageTitle
        title={edition.name}
        subtitle={subtitle}
        action={
          admin && (
            <Link
              href={`/edicoes/${edition.id}/configuracoes`}
              className="btn btn-icon"
              title="Configurações"
              aria-label="Configurações da edição"
            >
              <SettingsIcon width={22} height={22} />
            </Link>
          )
        }
      />
      {edition.notes && (
        <p className="-mt-4 mb-8 text-body text-muted">{edition.notes}</p>
      )}

      {/* Sempre presente, para notar o instante em que surge um campeão. */}
      <ChampionParty
        editionName={edition.name}
        champion={partyPerson("campeao")}
        vice={partyPerson("vice")}
        third={partyPerson("terceiro")}
        auto={admin && !manual}
      />

      <Podium view={view} />

      {!manual && !setup && (
        <Tournament view={view} admin={admin} tiers={tiers} />
      )}

      {(manual || setup) && (
        <Section
          reveal
          title="Participantes"
          aside={
            entries.length
              ? plural(entries.length, "inscrito", "inscritos")
              : ""
          }
        >
          <Participants
            view={view}
            admin={admin}
            editable
            knownTeams={edition.useTeams ? knownTeams : []}
            tiers={tiers}
            myId={myId}
          />
        </Section>
      )}

      {admin && setup && (
        <Section reveal title="Sorteio e início">
          <div className="card flex flex-col gap-4 p-5">
            <p className="text-body text-muted">
              {edition.useTeams ? (
                <>
                  {plural(edition.teamPool.length, "time", "times")} na lista do
                  sorteio para{" "}
                  {plural(entries.length, "participante", "participantes")}.
                  {withoutTeam > 0
                    ? ` ${plural(withoutTeam, "ainda está", "ainda estão")} sem time.`
                    : entries.length > 0
                      ? " Todos já têm time."
                      : ""}
                </>
              ) : (
                `Torneio só com os jogadores, sem times: ${plural(entries.length, "participante", "participantes")}.`
              )}
            </p>
            {configProblem && (
              <p className="text-body text-danger">{configProblem}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {edition.useTeams && (
                <DrawPanel
                  editionId={edition.id}
                  hasTeams={entries.some((e) => e.teamId != null)}
                />
              )}
              <StartPanel
                editionId={edition.id}
                hasGroups={format === "grupos"}
                manualGroups={entries.some((e) => e.groupLabel != null)}
              />
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

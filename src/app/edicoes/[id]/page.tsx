import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteEditionAction,
  resetEditionAction,
  saveEntryAction,
  setParticipantsAction,
  setTeamPoolAction,
  updateEditionAction,
} from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import {
  ChampionParty,
  PartyButton,
  type PartyPerson,
} from "@/components/ChampionParty";
import { DrawPanel } from "@/components/DrawPanel";
import { FormatFields } from "@/components/FormatFields";
import { StartPanel } from "@/components/GroupDraw";
import { GroupsEditor } from "@/components/GroupsEditor";
import { KnockoutEditor } from "@/components/KnockoutEditor";
import { Tabs, type TabItem } from "@/components/Tabs";
import { MatchRow, type MatchSide } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TrophyIcon } from "@/components/icons";
import {
  Disclosure,
  Empty,
  PageTitle,
  PersonRow,
  Section,
} from "@/components/ui";
import type { Match } from "@/db/schema";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import {
  FORMAT_LABELS,
  RESULT_LABELS,
  RESULT_ORDER,
  STATUS_LABELS,
  arcade,
  formatDate,
  pairingNote,
  plural,
  resultLabel,
  resultRank,
  roundLabel,
  sourceLabel,
} from "@/lib/labels";
import {
  configOf,
  editionView,
  listPlayers,
  type EditionView,
  type EntryView,
} from "@/lib/services";
import {
  knockoutRounds,
  standingsByGroup,
  validateConfig,
  type Format,
} from "@/lib/tournament";
import { getDb } from "@/db";

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
  const others = [by("vice"), by("terceiro")].filter((e) => e != null);
  return (
    <div className="card p-6">
      <div className="flex items-center gap-4">
        <Avatar
          name={champion.player.name}
          photoUrl={champion.player.photoUrl}
          size={72}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-body font-semibold text-accent">
            <TrophyIcon width={18} height={18} />
            Campeão
          </p>
          <Link
            href={`/jogadores/${champion.playerId}`}
            className="block truncate text-title"
            aria-label={champion.player.name}
          >
            {arcade(champion.player.name)}
          </Link>
          <p className="truncate text-body text-muted">{champion.team?.name}</p>
        </div>
      </div>
      {others.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {others.map((e) => (
            <PersonRow
              key={e.id}
              href={`/jogadores/${e.playerId}`}
              name={e.player.name}
              photoUrl={e.player.photoUrl}
              detail={[resultLabel(e.result), e.team?.name]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}
      <div className="-mb-2 -ml-2 mt-2">
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
}: {
  matches: Match[];
  view: EditionView;
  admin: boolean;
  totalRounds: number;
}) {
  const entryById = new Map(view.entries.map((e) => [e.id, e]));
  const side = (entryId: number | null): MatchSide | null => {
    const e = entryId != null ? entryById.get(entryId) : null;
    return e
      ? { playerId: e.playerId, name: e.player.name, team: e.team?.name ?? null }
      : null;
  };
  return (
    <div className="card px-5 py-1.5">
      {matches.map((m) => (
        <MatchRow
          key={m.id}
          matchId={m.id}
          knockout={m.stage !== "grupo"}
          home={side(m.homeEntryId)}
          away={side(m.awayEntryId)}
          homePlaceholder={sourceLabel(m.homeSource, view.edition.format, totalRounds)}
          awayPlaceholder={sourceLabel(m.awaySource, view.edition.format, totalRounds)}
          homeScore={m.homeScore}
          awayScore={m.awayScore}
          homePens={m.homePens}
          awayPens={m.awayPens}
          admin={admin}
        />
      ))}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-body text-muted">{children}</h3>;
}

function Tournament({ view, admin }: { view: EditionView; admin: boolean }) {
  const { edition, entries, matches } = view;
  const totalRounds = knockoutRounds(matches);
  const groupMatches = matches.filter((m) => m.stage === "grupo");
  const knockout = matches.filter((m) => m.stage !== "grupo");
  const tables = groupMatches.length ? standingsByGroup(entries, matches) : [];
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const full = tables.length ? Math.floor(edition.qualifiers / tables.length) : 0;
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
      if (third.length) stages.push({ label: "Disputa de 3º lugar", matches: third });
    }
    const ms = knockout.filter((m) => m.stage === "mata" && m.round === r);
    if (ms.length) stages.push({ label: roundLabel(r, totalRounds), matches: ms });
  }

  const rounds = [...new Set(groupMatches.map((m) => m.round))].sort((a, b) => a - b);

  const tabs: TabItem[] = [];

  if (tables.length > 0) {
    tabs.push({
      id: "grupos",
      label: edition.format === "liga" ? "Classificação" : "Grupos",
      content: (
        <>
          <p className="mb-4 text-body text-muted">{rule}</p>
          <div className="grid grid-cols-1 gap-4">
            {tables.map((t) => (
              <div key={t.label} className="card px-5 pb-2 pt-4">
                {tables.length > 1 && (
                  <h3 className="mb-2 text-name font-semibold">Grupo {t.label}</h3>
                )}
                <StandingsTable
                  rows={t.rows}
                  entries={entryById}
                  qualifying={edition.qualifiers === 0 ? 1 : full}
                />
              </div>
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
      label: edition.format === "grupos" ? "Jogos dos grupos" : "Jogos",
      content: (
        <>
          {edition.format === "grupos" && edition.pairing !== "interno" && (
            <p className="mb-4 text-body text-muted">
              {pairingNote(edition.pairing, edition.crossGames)}
            </p>
          )}
          {rounds.map((round) => {
            const ms = groupMatches
              .filter((m) => m.round === round)
              .sort(
                (a, b) =>
                  (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") ||
                  a.slot - b.slot,
              );
            return (
              <div key={round} className="mt-5 first:mt-0">
                <SubHeading>Rodada {round}</SubHeading>
                <MatchList
                  matches={ms}
                  view={view}
                  admin={admin}
                  totalRounds={totalRounds}
                />
              </div>
            );
          })}
        </>
      ),
    });
  }

  // Abre direto no mata-mata quando a fase de grupos já acabou.
  const groupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => m.homeScore != null);
  const initial = groupsDone && stages.length > 0 ? "mata" : undefined;

  if (tabs.length === 0) return null;
  // Uma só parte (ex.: mata-mata puro): não precisa de abas.
  if (tabs.length === 1) return <div className="mt-10">{tabs[0].content}</div>;
  return <Tabs tabs={tabs} initial={initial} />;
}

/** Time (e colocação, no registro histórico) de um participante. */
function EntryForm({ entry, manual }: { entry: EntryView; manual: boolean }) {
  return (
    <ActionForm
      key={`${entry.teamId}:${entry.result}`}
      action={saveEntryAction}
      className="flex flex-wrap items-center justify-end gap-2 pb-3 sm:pb-0"
    >
      <input type="hidden" name="entryId" value={entry.id} />
      <input
        name="team"
        list="known-teams"
        defaultValue={entry.team?.name ?? ""}
        placeholder="Time"
        aria-label={`Time de ${entry.player.name}`}
        className="field w-40"
      />
      {manual && (
        <select
          name="result"
          defaultValue={entry.result ?? ""}
          aria-label={`Colocação de ${entry.player.name}`}
          className="field w-44"
        >
          <option value="">Só participou</option>
          {RESULT_ORDER.filter((r) => r !== "participou" && r !== "eliminado").map(
            (r) => (
              <option key={r} value={r}>
                {RESULT_LABELS[r]}
              </option>
            ),
          )}
        </select>
      )}
      <SubmitButton className="btn">Salvar</SubmitButton>
    </ActionForm>
  );
}

function Participants({
  view,
  admin,
  editable,
}: {
  view: EditionView;
  admin: boolean;
  editable: boolean;
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
    <div className="card px-5 py-1.5">
      {list.map((e) => (
        <div
          key={e.id}
          className={admin && editable ? "sm:flex sm:items-center sm:gap-3" : ""}
        >
          <div className="min-w-0 flex-1">
            <PersonRow
              href={`/jogadores/${e.playerId}`}
              name={e.player.name}
              photoUrl={e.player.photoUrl}
              detail={
                [
                  e.team?.name ?? "Sem time",
                  e.groupLabel ? `Grupo ${e.groupLabel}` : "",
                  manual ? resultLabel(e.result) : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
            />
          </div>
          {admin && editable && <EntryForm entry={e} manual={manual} />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default async function EditionPage(props: PageProps<"/edicoes/[id]">) {
  const [{ data, view }, admin] = await Promise.all([
    load(props.params),
    isAdmin(),
  ]);
  if (!view) notFound();
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
    matches.length ? `${played} de ${plural(matches.length, "jogo", "jogos")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const partyPerson = (result: string): PartyPerson | null => {
    const e = entries.find((entry) => entry.result === result);
    return e
      ? { entryId: e.id, name: e.player.name, team: e.team?.name ?? null }
      : null;
  };

  const allPlayers = admin ? await listPlayers(getDb()) : [];
  const inEdition = new Set(entries.map((e) => e.playerId));
  const withoutTeam = entries.filter((e) => e.teamId == null).length;
  const configProblem = setup ? validateConfig(configOf(edition), entries.length) : null;
  const knownTeams = [
    ...new Set([...edition.teamPool, ...data.teams.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <PageTitle title={edition.name} subtitle={subtitle} />
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

      {!manual && !setup && <Tournament view={view} admin={admin} />}

      {(manual || setup) && (
        <Section
          title="Participantes"
          aside={entries.length ? plural(entries.length, "inscrito", "inscritos") : ""}
        >
          <Participants view={view} admin={admin} editable />
          <datalist id="known-teams">
            {knownTeams.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Section>
      )}

      {admin && setup && (
        <Section title="Sorteio e início">
          <div className="card flex flex-col gap-4 p-5">
            <p className="text-body text-muted">
              {plural(edition.teamPool.length, "time", "times")} na lista do
              sorteio para {plural(entries.length, "participante", "participantes")}.
              {withoutTeam > 0
                ? ` ${plural(withoutTeam, "ainda está", "ainda estão")} sem time.`
                : entries.length > 0
                  ? " Todos já têm time."
                  : ""}
            </p>
            {configProblem && (
              <p className="text-body text-danger">{configProblem}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <DrawPanel
                editionId={edition.id}
                hasTeams={entries.some((e) => e.teamId != null)}
              />
              <StartPanel
                editionId={edition.id}
                hasGroups={format === "grupos"}
                manualGroups={entries.some((e) => e.groupLabel != null)}
              />
            </div>
          </div>
        </Section>
      )}

      {admin && (
        <Section title="Administração">
          <div className="grid grid-cols-1 gap-3">
            {(manual || setup) && (
              <Disclosure title="Participantes">
                <ActionForm
                  key={entries.map((e) => e.playerId).join(",")}
                  action={setParticipantsAction}
                  className="flex flex-col gap-3"
                >
                  <input type="hidden" name="editionId" value={edition.id} />
                  <div className="-mx-1 flex flex-wrap gap-1">
                    {allPlayers.map((p) => (
                      <label
                        key={p.id}
                        className="chip cursor-pointer has-checked:bg-wash has-checked:font-semibold has-checked:text-ink"
                      >
                        <input
                          type="checkbox"
                          name="playerId"
                          value={p.id}
                          defaultChecked={inEdition.has(p.id)}
                          className="sr-only"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  <input
                    name="newPlayers"
                    className="field"
                    placeholder="Gente nova? Nomes separados por vírgula"
                  />
                  <div>
                    <SubmitButton className="btn">Salvar participantes</SubmitButton>
                  </div>
                </ActionForm>
              </Disclosure>
            )}

            {setup && (
              <Disclosure title="Times do sorteio">
                <ActionForm
                  key={edition.teamPool.join("|")}
                  action={setTeamPoolAction}
                  className="flex flex-col gap-3"
                >
                  <input type="hidden" name="editionId" value={edition.id} />
                  <textarea
                    name="teamPool"
                    rows={8}
                    className="field"
                    aria-label="Times do sorteio, um por linha"
                    placeholder={"Um time por linha"}
                    defaultValue={edition.teamPool.join("\n")}
                  />
                  <div>
                    <SubmitButton className="btn">Salvar times</SubmitButton>
                  </div>
                </ActionForm>
              </Disclosure>
            )}

            {format === "grupos" && entries.length > 0 && (
              <Disclosure title="Grupos e rodadas">
                <GroupsEditor
                  editionId={edition.id}
                  groupsCount={edition.groupsCount}
                  started={!setup}
                  entries={entries.map((e) => ({
                    id: e.id,
                    name: e.player.name,
                    team: e.team?.name ?? null,
                    groupLabel: e.groupLabel,
                  }))}
                />
              </Disclosure>
            )}

            {!manual && !setup && knockoutRounds(matches) > 0 && (
              <Disclosure title="Confrontos do mata-mata">
                <KnockoutEditor
                  editionId={edition.id}
                  totalRounds={knockoutRounds(matches)}
                  matches={matches.filter((m) => m.stage === "mata")}
                  entries={entries.map((e) => ({
                    id: e.id,
                    name: e.player.name,
                    team: e.team?.name ?? null,
                  }))}
                />
              </Disclosure>
            )}

            <Disclosure title={setup ? "Dados e formato" : "Dados da edição"}>
              <ActionForm action={updateEditionAction} className="flex flex-col gap-4">
                <input type="hidden" name="editionId" value={edition.id} />
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label>
                    <span className="label">Nome</span>
                    <input name="name" className="field" defaultValue={edition.name} required />
                  </label>
                  <label>
                    <span className="label">Número</span>
                    <input
                      name="number"
                      type="number"
                      min={1}
                      className="field num"
                      defaultValue={edition.number}
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="label">Jogo</span>
                    <input name="game" className="field" defaultValue={edition.game} required />
                  </label>
                  <label>
                    <span className="label">Data</span>
                    <input
                      name="playedOn"
                      type="date"
                      className="field"
                      defaultValue={edition.playedOn ?? ""}
                    />
                  </label>
                </div>
                <label>
                  <span className="label">Observações</span>
                  <textarea
                    name="notes"
                    rows={2}
                    className="field"
                    defaultValue={edition.notes ?? ""}
                    placeholder="Onde foi, quem levou a pizza, polêmicas..."
                  />
                </label>
                {setup ? (
                  <FormatFields
                    initial={configOf(edition)}
                    participants={entries.length}
                    allowManual={false}
                  />
                ) : (
                  <input type="hidden" name="format" value="manual" />
                )}
                <div>
                  <SubmitButton className="btn">Salvar dados</SubmitButton>
                </div>
              </ActionForm>
            </Disclosure>

            <div className="flex flex-wrap gap-1 pt-1">
              {!manual && !setup && (
                <ActionForm action={resetEditionAction}>
                  <input type="hidden" name="editionId" value={edition.id} />
                  <SubmitButton
                    className="btn btn-danger"
                    confirm="Desfazer a tabela? Todos os jogos e placares desta edição serão apagados."
                  >
                    Desfazer tabela
                  </SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={deleteEditionAction}>
                <input type="hidden" name="editionId" value={edition.id} />
                <SubmitButton
                  className="btn btn-danger"
                  confirm={`Excluir ${edition.name}? Isso apaga a edição inteira do histórico.`}
                >
                  Excluir edição
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

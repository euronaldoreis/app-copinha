import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteEditionAction,
  resetEditionAction,
  setParticipantsAction,
  setTeamPoolAction,
  updateEditionAction,
} from "@/app/actions";
import { EntryControls } from "@/components/EntryControls";
import { FormatFields } from "@/components/FormatFields";
import { GroupsEditor } from "@/components/GroupsEditor";
import { KnockoutEditor } from "@/components/KnockoutEditor";
import { KnockoutPhases } from "@/components/KnockoutPhases";
import { LateEntryForm } from "@/components/LateEntryForm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ChevronIcon } from "@/components/icons";
import { Disclosure, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { configOf, editionView, listPlayers } from "@/lib/services";
import { GROUP_LABELS, knockoutRounds, type Format } from "@/lib/tournament";

export const metadata: Metadata = { title: "Configurações da edição" };

/**
 * Configurações de uma edição (só admin): participantes, times do sorteio,
 * grupos e rodadas, fases e confrontos do mata-mata, dados, desfazer e excluir.
 */
export default async function EditionSettingsPage(
  props: PageProps<"/edicoes/[id]/configuracoes">,
) {
  const [{ id }, admin] = await Promise.all([props.params, isAdmin()]);
  if (!admin) redirect("/admin");
  const data = await getData();
  const view = /^\d+$/.test(id) ? editionView(data, Number(id)) : null;
  if (!view) notFound();

  const { edition, entries, matches } = view;
  const format = edition.format as Format;
  const manual = format === "manual";
  const setup = edition.status === "inscricoes";
  const allPlayers = await listPlayers(getDb());
  const inEdition = new Set(entries.map((e) => e.playerId));
  // Incluir alguém com a edição andando: só com grupos/liga e antes de o
  // mata-mata ter placar.
  const canAddLate =
    edition.status === "andamento" &&
    (format === "grupos" || format === "liga") &&
    !matches.some((m) => m.stage !== "grupo" && m.homeScore != null);
  const groupLabels =
    format === "grupos" ? GROUP_LABELS.slice(0, edition.groupsCount) : [];
  const groupSize = (label: string) =>
    entries.filter((e) => e.groupLabel === label).length;
  const takenTeams = new Set(entries.map((e) => e.team?.name).filter(Boolean));
  const freeTeams = edition.teamPool.filter((t) => !takenTeams.has(t));
  const outside = allPlayers.filter((p) => !inEdition.has(p.id));
  const knownTeams = [
    ...new Set([...edition.teamPool, ...data.teams.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const byName = [...entries].sort((a, b) =>
    a.player.name.localeCompare(b.player.name, "pt-BR"),
  );

  return (
    <>
      <PageTitle title="Configurações" subtitle={edition.name} />
      <Link
        href={`/edicoes/${edition.id}`}
        className="btn btn-quiet -mt-4 mb-6 px-0"
      >
        <ChevronIcon className="rotate-180" />
        Voltar para a edição
      </Link>

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
                <SubmitButton className="btn">
                  Salvar participantes
                </SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        )}

        {!manual && !setup && edition.useTeams && entries.length > 0 && (
          <Disclosure title="Times dos participantes">
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted">
                Troca só o time: jogos, placares e grupos continuam como estão.
              </p>
              <ul className="flex flex-col gap-2">
                {byName.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 font-black sm:w-32 sm:truncate">
                      {e.player.name}
                    </span>
                    <EntryControls
                      // recria o estado quando o time muda no servidor
                      key={`${e.id}:${e.teamId}`}
                      entryId={e.id}
                      playerName={e.player.name}
                      team={e.team?.name ?? null}
                      result={e.result}
                      manual={false}
                      useTeams
                      removable={false}
                      knownTeams={knownTeams}
                      takenTeams={entries
                        .filter((x) => x.id !== e.id && x.team)
                        .map((x) => x.team!.name)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </Disclosure>
        )}

        {canAddLate && (
          <Disclosure title="Incluir participante">
            <LateEntryForm
              editionId={edition.id}
              groups={groupLabels.map((g) => ({
                label: g,
                size: groupSize(g),
              }))}
              liga={format === "liga"}
              useTeams={edition.useTeams}
              freeTeams={freeTeams}
              players={outside.map((p) => ({ id: p.id, name: p.name }))}
            />
          </Disclosure>
        )}

        {setup && edition.useTeams && (
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

        {(format === "grupos" || format === "liga") && !setup && (
          <Disclosure title="Fases do mata-mata">
            <KnockoutPhases
              editionId={edition.id}
              format={format}
              qualifiers={edition.qualifiers}
              thirdPlace={edition.thirdPlace}
              playoffs={edition.playoffs}
              participants={entries.length}
              groupsCount={format === "grupos" ? edition.groupsCount : 1}
            />
          </Disclosure>
        )}

        {!manual && !setup && knockoutRounds(matches) > 0 && (
          <Disclosure title="Confrontos do mata-mata">
            <KnockoutEditor
              editionId={edition.id}
              totalRounds={knockoutRounds(matches)}
              matches={matches.filter(
                (m) => m.stage === "mata" || m.stage === "repescagem",
              )}
              entries={entries.map((e) => ({
                id: e.id,
                name: e.player.name,
                team: e.team?.name ?? null,
              }))}
            />
          </Disclosure>
        )}

        <Disclosure title={setup ? "Dados e formato" : "Dados da edição"}>
          <ActionForm
            action={updateEditionAction}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="editionId" value={edition.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label>
                <span className="label">Nome</span>
                <input
                  name="name"
                  className="field"
                  defaultValue={edition.name}
                  required
                />
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
                <input
                  name="game"
                  className="field"
                  defaultValue={edition.game}
                  required
                />
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
            {setup && (
              <label className="flex items-center gap-2.5 text-body">
                <input
                  type="checkbox"
                  name="useTeams"
                  defaultChecked={edition.useTeams}
                  className="size-4 accent-accent"
                />
                Cada participante joga com um time
              </label>
            )}
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
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePlayerAction, updatePlayerAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { PhotoField } from "@/components/PhotoField";
import { isUploadedPhoto } from "@/lib/photo";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Disclosure, Empty, Section, Stat } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { arcade, formatDate, plural, resultLabel } from "@/lib/labels";
import { sortEditions } from "@/lib/services";
import { computeHeadToHead, computeRanking, pct } from "@/lib/stats";

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  const data = await getData();
  const player = /^\d+$/.test(id)
    ? data.players.find((p) => p.id === Number(id))
    : undefined;
  return { data, player };
}

export async function generateMetadata(
  props: PageProps<"/jogadores/[id]">,
): Promise<Metadata> {
  const { player } = await load(props.params);
  return { title: player?.name ?? "Jogador" };
}

export default async function PlayerPage(props: PageProps<"/jogadores/[id]">) {
  const [{ data, player }, admin] = await Promise.all([
    load(props.params),
    isAdmin(),
  ]);
  if (!player) notFound();

  const stats = computeRanking(data).find((r) => r.player.id === player.id)!;
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  const campaigns = sortEditions(
    data.editions.filter((e) => e.status !== "inscricoes"),
  ).flatMap((edition) => {
    const entry = data.entries.find(
      (e) => e.editionId === edition.id && e.playerId === player.id,
    );
    return entry ? [{ edition, entry }] : [];
  });
  const rivals = computeHeadToHead(data, player.id);
  const hasHistory = data.entries.some((e) => e.playerId === player.id);

  return (
    <>
      <header className="pitch -mx-6 mb-8 flex items-center gap-5 px-6 py-5">
        <Avatar
          name={player.name}
          photoUrl={player.photoUrl}
          avatar={player.avatar}
          size={88}
        />
        <div className="min-w-0">
          <h1 className="truncate text-title" aria-label={player.name}>
            {arcade(player.name)}
          </h1>
          <p className="mt-1.5 text-body text-muted">
            {stats.participations
              ? plural(stats.participations, "participação", "participações")
              : "Ainda não participou de nenhuma edição"}
            {stats.bestResult &&
              ` · melhor campanha: ${resultLabel(stats.bestResult).toLowerCase()}`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.titles} label={stats.titles === 1 ? "Título" : "Títulos"} />
        <Stat value={stats.finals} label={stats.finals === 1 ? "Final" : "Finais"} />
        <Stat value={stats.podiums} label={stats.podiums === 1 ? "Pódio" : "Pódios"} />
        <Stat
          value={stats.pct != null ? `${stats.pct}%` : "–"}
          label="Aproveitamento"
        />
      </div>

      {stats.played > 0 && (
        <p className="num mt-4 px-1 text-body text-muted">
          {plural(stats.played, "jogo", "jogos")} · {stats.wins}V {stats.draws}E{" "}
          {stats.losses}D · {plural(stats.gf, "gol marcado", "gols marcados")} ·{" "}
          {plural(stats.ga, "sofrido", "sofridos")}
        </p>
      )}

      <Section title="Campanhas">
        {campaigns.length === 0 ? (
          <Empty>Nenhuma campanha registrada.</Empty>
        ) : (
          <div className="card px-5 py-1.5">
            {campaigns.map(({ edition, entry }) => {
              const team = entry.teamId != null ? teamById.get(entry.teamId) : null;
              const result =
                resultLabel(entry.result) ||
                (edition.status === "andamento" ? "Em andamento" : "Participou");
              return (
                <Link
                  key={edition.id}
                  href={`/edicoes/${edition.id}`}
                  className="flex min-h-[68px] items-center gap-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-name font-semibold">
                      {edition.name}
                    </span>
                    <span className="block truncate text-body text-muted">
                      {[team?.name, edition.game, formatDate(edition.playedOn)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-body ${
                      entry.result === "campeao"
                        ? "font-semibold text-accent"
                        : "text-muted"
                    }`}
                  >
                    {result}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {rivals.length > 0 && (
        <Section title="Retrospecto contra cada um">
          <div className="card px-5 pb-2 pt-4">
            <table className="w-full text-body">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 text-left font-normal">Rival</th>
                  <th className="px-1.5 pb-2 text-right font-normal" title="Jogos">J</th>
                  <th className="px-1.5 pb-2 text-right font-normal" title="Vitórias">V</th>
                  <th className="px-1.5 pb-2 text-right font-normal" title="Empates">E</th>
                  <th className="px-1.5 pb-2 text-right font-normal" title="Derrotas">D</th>
                  <th className="hidden px-1.5 pb-2 text-right font-normal sm:table-cell" title="Gols">
                    Gols
                  </th>
                  <th className="px-1.5 pb-2 text-right font-normal" title="Aproveitamento">%</th>
                </tr>
              </thead>
              <tbody>
                {rivals.map((r) => (
                  <tr key={r.opponent.id} className="h-[52px]">
                    <td className="w-full max-w-0">
                      <Link
                        href={`/jogadores/${r.opponent.id}`}
                        className="block truncate text-name font-semibold"
                      >
                        {r.opponent.name}
                      </Link>
                    </td>
                    <td className="num px-1.5 text-right">{r.played}</td>
                    <td className="num px-1.5 text-right">{r.wins}</td>
                    <td className="num px-1.5 text-right">{r.draws}</td>
                    <td className="num px-1.5 text-right">{r.losses}</td>
                    <td className="num hidden whitespace-nowrap px-1.5 text-right sm:table-cell">
                      {r.gf}–{r.ga}
                    </td>
                    <td className="num px-1.5 text-right text-name font-semibold">
                      {pct(r)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {admin && (
        <Section title="Administração">
          <Disclosure title="Editar jogador">
            <ActionForm
              key={`${player.name}|${player.photoUrl}|${JSON.stringify(player.avatar)}`}
              action={updatePlayerAction}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="playerId" value={player.id} />
              <label>
                <span className="label">Nome</span>
                <input
                  name="name"
                  className="field"
                  defaultValue={player.name}
                  required
                  maxLength={40}
                />
              </label>
              <AvatarEditor
                name={player.name}
                photoUrl={player.photoUrl}
                initial={player.avatar}
              />
              <PhotoField currentUrl={player.photoUrl} />
              <label>
                <span className="label">Ou um link de foto</span>
                <input
                  name="photoUrl"
                  type="url"
                  className="field"
                  defaultValue={isUploadedPhoto(player.photoUrl) ? "" : (player.photoUrl ?? "")}
                  placeholder="https://..."
                />
              </label>
              <div>
                <SubmitButton className="btn">Salvar</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
          {!hasHistory && (
            <ActionForm action={deletePlayerAction} className="mt-2">
              <input type="hidden" name="playerId" value={player.id} />
              <SubmitButton
                className="btn btn-danger"
                confirm={`Excluir ${player.name}?`}
              >
                Excluir jogador
              </SubmitButton>
            </ActionForm>
          )}
        </Section>
      )}
    </>
  );
}

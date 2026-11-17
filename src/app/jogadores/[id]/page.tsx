import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePlayerAction, updatePlayerAction } from "@/app/actions";
import { Arcade } from "@/components/Arcade";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { PhotoField } from "@/components/PhotoField";
import { isUploadedPhoto } from "@/lib/photo";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Disclosure, Empty, Section } from "@/components/ui";
import { SwordsIcon, TrophyIcon } from "@/components/icons";
import { Ball3D, Podium3D, Star3D, Trophy3D } from "@/components/icons3d";
import { TIER_LABELS, tierOf } from "@/lib/tier";
import type { Edition, Entry, Team } from "@/db/schema";
import type { ReactNode } from "react";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { formatDate, plural, resultLabel } from "@/lib/labels";
import { sortEditions } from "@/lib/services";
import { AttributeRadar } from "@/components/AttributeRadar";
import { ATTRIBUTES, computeAttributes } from "@/lib/attributes";
import { computeHeadToHead, computeRanking, pct } from "@/lib/stats";

/** Quadro de número com ícone, como os contadores de um jogo. */
function StatTile({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-1 px-1 py-3 text-center">
      <span className="[&_svg]:size-7">{icon}</span>
      <span className="num text-outline font-pixel text-[26px] leading-none">{value}</span>
      <span className="text-[12px] font-bold text-muted">{label}</span>
    </div>
  );
}

/** Uma edição disputada: ícone, nome, time e a colocação num selo. */
function CampaignRow({
  edition,
  entry,
  teamById,
}: {
  edition: Edition;
  entry: Entry;
  teamById: Map<number, Team>;
}) {
  const team = entry.teamId != null ? teamById.get(entry.teamId) : null;
  const champion = entry.result === "campeao";
  const result =
    resultLabel(entry.result) ||
    (edition.status === "andamento"
      ? "Em andamento"
      : edition.status === "inscricoes"
        ? "Inscrito"
        : "Participou");
  return (
    <Link
      href={`/edicoes/${edition.id}`}
      className="card flex min-h-[68px] items-center gap-3.5 px-4 py-3"
    >
      <span className={champion ? "text-accent" : "text-muted"}>
        {champion ? (
          <TrophyIcon width={26} height={26} />
        ) : (
          <SwordsIcon width={26} height={26} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-name font-black">
          {edition.name}
        </span>
        <span className="block truncate text-[14px] font-semibold text-muted">
          {team ? `Jogou de ${team.name}` : formatDate(edition.playedOn)}
        </span>
      </span>
      <span className={`result-pill ${champion ? "result-pill-gold" : ""}`}>
        {result}
      </span>
    </Link>
  );
}

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

  const ranking = computeRanking(data);
  const stats = ranking.find((r) => r.player.id === player.id)!;
  const attributes = computeAttributes(
    stats,
    Math.max(...ranking.map((r) => r.played)),
  );
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  // Todas as edições em que o jogador está inscrito, da mais recente à mais antiga.
  const allCampaigns = sortEditions(data.editions).flatMap((edition) => {
    const entry = data.entries.find(
      (e) => e.editionId === edition.id && e.playerId === player.id,
    );
    return entry ? [{ edition, entry }] : [];
  });
  // A "última campanha" é a mais recente que já começou.
  const latest =
    allCampaigns.find((c) => c.edition.status !== "inscricoes") ??
    allCampaigns[0];
  const tier = tierOf(stats.bestResult, stats.titles);
  const rivals = computeHeadToHead(data, player.id);
  const hasHistory = data.entries.some((e) => e.playerId === player.id);

  return (
    <>
      {/* Carta do jogador e resumo, como a tela de um personagem. */}
      <header className="grid grid-cols-[minmax(0,148px)_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        {/* Mesma carta da lista de jogadores, maior. */}
        <div className={`player-card profile-card tier-${tier}`}>
          <span className="flex w-full items-center justify-between gap-1">
            <span className="player-badge" title="Nível: edições disputadas">
              Nv {stats.participations}
            </span>
            <span
              className="player-badge !px-1.5"
              title={plural(stats.titles, "título", "títulos")}
            >
              <Trophy3D width={16} height={16} />
              <span className="num">{stats.titles}</span>
            </span>
          </span>
          <span className="profile-card-photo">
            <Avatar
              name={player.name}
              photoUrl={player.photoUrl}
              avatar={player.avatar}
              size={104}
            />
          </span>
          <span className="player-plate whitespace-nowrap text-[12px] font-black uppercase tracking-wide text-accent">
            {stats.participations ? TIER_LABELS[tier] : "Estreante"}
          </span>
        </div>

        <div className="min-w-0 pt-1">
          <h1
            className="text-title font-pixel leading-none"
            aria-label={player.name}
          >
            <Arcade>{player.name}</Arcade>
          </h1>
          <p className="mt-2 text-[14px] font-bold leading-snug text-muted">
            {stats.participations
              ? plural(stats.participations, "participação", "participações")
              : "Ainda não participou de nenhuma edição"}
            {stats.bestResult &&
              ` · melhor campanha: ${resultLabel(stats.bestResult).toLowerCase()}`}
          </p>
          {stats.played > 0 && (
            <>
              <div className="mt-3 flex items-baseline justify-between gap-2 text-[14px] font-black">
                <span>Aproveitamento</span>
                <span className="num text-accent">{stats.pct ?? 0}%</span>
              </div>
              <div
                className="progress mt-1.5"
                role="progressbar"
                aria-label="Aproveitamento"
                aria-valuenow={stats.pct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${stats.pct ?? 0}%` }} />
              </div>
              <p className="num mt-2 text-[13px] font-bold leading-snug text-muted">
                {stats.wins}V {stats.draws}E {stats.losses}D ·{" "}
                {plural(stats.gf, "gol marcado", "gols marcados")} ·{" "}
                {plural(stats.ga, "sofrido", "sofridos")}
              </p>
            </>
          )}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          icon={<Trophy3D />}
          value={stats.titles}
          label={stats.titles === 1 ? "Título" : "Títulos"}
        />
        <StatTile
          icon={<Star3D />}
          value={stats.finals}
          label={stats.finals === 1 ? "Final" : "Finais"}
        />
        <StatTile
          icon={<Podium3D />}
          value={stats.podiums}
          label={stats.podiums === 1 ? "Pódio" : "Pódios"}
        />
        <StatTile
          icon={<Ball3D />}
          value={stats.played}
          label={stats.played === 1 ? "Jogo" : "Jogos"}
        />
      </div>

      {attributes && (
        <Section title="Atributos">
          <div className="card grid grid-cols-1 items-center gap-3 px-3 py-4 sm:px-6">
            <AttributeRadar values={attributes} />
            {/* <dl className="flex flex-col gap-1.5">
              {ATTRIBUTES.map((a) => (
                <div key={a.key} className="flex items-baseline justify-between gap-2" title={a.hint}>
                  <dt className="font-pixel text-[15px]">{a.label}</dt>
                  <dd className="truncate text-[13px] font-bold text-muted">{a.short}</dd>
                </div>
              ))}
            </dl> */}
          </div>
        </Section>
      )}

      {!latest ? (
        <Section title="Campanhas">
          <Empty>Nenhuma campanha registrada.</Empty>
        </Section>
      ) : (
        <>
          <Section title="Última campanha">
            <CampaignRow {...latest} teamById={teamById} />
          </Section>
          <Section
            title="Todas as campanhas"
            aside={plural(allCampaigns.length, "edição", "edições")}
          >
            <div className="flex flex-col gap-3">
              {allCampaigns.map((c) => (
                <CampaignRow key={c.edition.id} {...c} teamById={teamById} />
              ))}
            </div>
          </Section>
        </>
      )}

      {rivals.length > 0 && (
        <Section title="Retrospecto contra cada um">
          <div className="card px-5 pb-2 pt-4">
            <table className="w-full text-body">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 text-left font-normal">Rival</th>
                  <th
                    className="px-1.5 pb-2 text-right font-normal"
                    title="Jogos"
                  >
                    J
                  </th>
                  <th
                    className="px-1.5 pb-2 text-right font-normal"
                    title="Vitórias"
                  >
                    V
                  </th>
                  <th
                    className="px-1.5 pb-2 text-right font-normal"
                    title="Empates"
                  >
                    E
                  </th>
                  <th
                    className="px-1.5 pb-2 text-right font-normal"
                    title="Derrotas"
                  >
                    D
                  </th>
                  <th
                    className="hidden px-1.5 pb-2 text-right font-normal sm:table-cell"
                    title="Gols"
                  >
                    Gols
                  </th>
                  <th
                    className="px-1.5 pb-2 text-right font-normal"
                    title="Aproveitamento"
                  >
                    %
                  </th>
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
                  defaultValue={
                    isUploadedPhoto(player.photoUrl)
                      ? ""
                      : (player.photoUrl ?? "")
                  }
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

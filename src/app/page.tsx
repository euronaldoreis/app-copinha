import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChevronIcon, TrophyIcon } from "@/components/icons";
import { Empty, PageTitle, PersonRow, Section } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { STATUS_LABELS, arcade, plural } from "@/lib/labels";
import { allEditionViews, type EditionView } from "@/lib/services";
import { computeRanking } from "@/lib/stats";

/** Edição aberta: placar parcial e os próximos jogos já definidos. */
function LiveEdition({ view }: { view: EditionView }) {
  const { edition, entries, matches } = view;
  const nameOf = new Map(entries.map((e) => [e.id, e.player.name]));
  const played = matches.filter((m) => m.homeScore != null).length;
  const upcoming = matches
    .filter(
      (m) =>
        m.homeScore == null && m.homeEntryId != null && m.awayEntryId != null,
    )
    .slice(0, 3);
  return (
    <Link href={`/edicoes/${edition.id}`} className="card block p-6">
      <p className="flex items-center gap-2 text-body font-semibold text-accent">
        <span className="blink size-2 bg-accent" />
        {STATUS_LABELS[edition.status]}
      </p>
      <p className="mt-1 text-title">{arcade(edition.name)}</p>
      <p className="mt-1 text-body text-muted">
        {[
          edition.game,
          plural(entries.length, "participante", "participantes"),
          matches.length
            ? `${played} de ${plural(matches.length, "jogo", "jogos")}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {upcoming.length > 0 && (
        <div className="mt-4 grid gap-1.5">
          <p className="text-body text-muted">Próximos jogos</p>
          {upcoming.map((m) => (
            <p key={m.id} className="text-name font-semibold">
              {nameOf.get(m.homeEntryId!)}{" "}
              <span className="font-normal text-faint">×</span>{" "}
              {nameOf.get(m.awayEntryId!)}
            </p>
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function HomePage() {
  const [data, admin] = await Promise.all([getData(), isAdmin()]);
  const views = allEditionViews(data);
  const open =
    views.find((v) => v.edition.status === "andamento") ??
    views.find((v) => v.edition.status === "inscricoes");
  const champions = views.flatMap((v) => {
    const entry = v.entries.find((e) => e.result === "campeao");
    return entry ? [{ edition: v.edition, entry }] : [];
  });
  const ranking = computeRanking(data).filter((r) => r.participations > 0);
  const gamesPlayed = data.matches.filter((m) => m.homeScore != null).length;

  const summary = [
    plural(views.length, "edição", "edições"),
    plural(ranking.length, "jogador", "jogadores"),
    gamesPlayed ? plural(gamesPlayed, "jogo", "jogos") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageTitle
        recycle
        title="Copinha dos Lixos"
        subtitle={
          views.length
            ? summary
            : "O torneio de FIFA e Bomba Patch mais lixosa que existe."
        }
      />

      {views.length === 0 && (
        <div className="card flex flex-col items-start gap-4 p-6">
          <p className="text-body text-muted">
            Ainda não há nenhuma Copinha registrada. Crie a primeira edição para
            sortear os times e gerar a tabela, ou registre as edições antigas
            para montar o histórico e o ranking.
          </p>
          <Link
            href={admin ? "/edicoes/nova" : "/admin"}
            className="btn btn-primary"
          >
            {admin ? "Criar a primeira edição" : "Entrar como organizador"}
          </Link>
        </div>
      )}

      {open && <LiveEdition view={open} />}

      {champions.length > 0 && (
        <Section title="Campeões">
          {/* Faixa de retratos: do campeão mais recente para o mais antigo. */}
          <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none]">
            {champions.map(({ edition, entry }) => (
              <Link
                key={edition.id}
                href={`/edicoes/${edition.id}`}
                className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-center"
              >
                <Avatar
                  name={entry.player.name}
                  photoUrl={entry.player.photoUrl}
                  size={64}
                />
                <span className="w-full">
                  <span className="block truncate text-body font-semibold">
                    {entry.player.name}
                  </span>
                  <span className="num block truncate text-body text-muted">
                    #{edition.number}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {ranking.length > 0 && (
        <Section
          title="Ranking"
          aside={
            <Link href="/ranking" className="flex items-center gap-0.5">
              Ver completo
              <ChevronIcon width={16} height={16} />
            </Link>
          }
        >
          <div className="card px-5 py-1.5">
            {ranking.slice(0, 5).map((r) => (
              <PersonRow
                key={r.player.id}
                href={`/jogadores/${r.player.id}`}
                name={r.player.name}
                photoUrl={r.player.photoUrl}
                detail={[
                  r.finals ? plural(r.finals, "final", "finais") : "",
                  plural(r.participations, "participação", "participações"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  r.titles > 0 ? (
                    <span
                      className="num flex items-center gap-1 text-name font-semibold text-accent"
                      title={plural(r.titles, "título", "títulos")}
                    >
                      {r.titles}
                      <TrophyIcon width={18} height={18} />
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        </Section>
      )}

      {views.length > 0 && ranking.length === 0 && (
        <Section title="Ranking">
          <Empty>O ranking aparece quando a primeira edição começar.</Empty>
        </Section>
      )}
    </>
  );
}

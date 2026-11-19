import Link from "next/link";
import type { CSSProperties } from "react";
import { Arcade } from "@/components/Arcade";
import { Avatar } from "@/components/Avatar";
import { ChevronIcon, SwordsIcon } from "@/components/icons";
import { Empty, PageTitle, Section } from "@/components/ui";
import { LeaderRow, PlayerMedia } from "@/components/Leaderboard";
import { currentPlayerId } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { STATUS_LABELS, plural } from "@/lib/labels";
import { allEditionViews, type EditionView } from "@/lib/services";
import { computeRanking, computeRecords } from "@/lib/stats";
import { recordItems } from "@/lib/recordItems";
import { RecordsTeaser } from "@/components/RecordsTeaser";
import { tierOf } from "@/lib/tier";

/** Edição aberta: a "arena", com o próximo confronto, o progresso e o atalho para a tabela. */
function LiveEdition({ view }: { view: EditionView }) {
  const { edition, entries, matches } = view;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const played = matches.filter((m) => m.homeScore != null).length;
  const upcoming = matches.filter(
    (m) =>
      m.homeScore == null && m.homeEntryId != null && m.awayEntryId != null,
  );
  const next = upcoming[0];
  const home = next && byId.get(next.homeEntryId!);
  const away = next && byId.get(next.awayEntryId!);
  const later = upcoming.slice(1, 3);
  const progress = matches.length
    ? Math.round((played / matches.length) * 100)
    : 0;

  return (
    <section className="anim-pop card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="tag">
          <span className="blink size-2 rounded-full bg-[#5bd94f]" />
          {STATUS_LABELS[edition.status]}
        </span>
        <span className="truncate text-body text-muted">
          {plural(entries.length, "participante", "participantes")}
        </span>
      </div>
      <h2 className="text-title" aria-label={edition.name}>
        <Arcade>{edition.name}</Arcade>
      </h2>

      {home && away && (
        <div className="arena relative flex h-28 items-center justify-between overflow-hidden rounded-[10px] border-2 border-night px-3">
          {[home, away].map((e, i) => (
            <span
              key={e.id}
              className={`relative flex w-24 flex-col items-center gap-1 ${i === 1 ? "slide-from-right order-3" : "slide-from-left"}`}
            >
              <Avatar
                name={e.player.name}
                photoUrl={e.player.photoUrl}
                avatar={e.player.avatar}
                size={56}
              />
              <span className="text-title w-full truncate text-center !text-[16px]">
                {e.player.name}
              </span>
            </span>
          ))}
          <span className="relative order-2 flex flex-col items-center gap-0.5">
            <span className="whitespace-nowrap rounded-full bg-night px-2 py-0.5 text-[11px] font-black uppercase tracking-wider">
              Próximo jogo
            </span>
            <span className="vs-pulse text-title !text-[34px] text-accent">
              VS
            </span>
          </span>
        </div>
      )}

      {matches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-body text-muted">
            <span>Progresso</span>
            <span className="num">
              {played} de {plural(matches.length, "jogo", "jogos")}
            </span>
          </div>
          <div
            className="meter"
            role="img"
            aria-label={`${played} de ${matches.length} jogos disputados`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <Link
        href={`/edicoes/${edition.id}`}
        className="btn btn-primary !min-h-14 !text-[22px]"
      >
        <SwordsIcon width={24} height={24} />
        <span className="flex-1 text-center">Ver a tabela</span>
        <ChevronIcon width={22} height={22} />
      </Link>

      {later.length > 0 && (
        <div className="mt-1 grid gap-1.5">
          <p className="heading">Depois</p>
          {later.map((m) => (
            <p
              key={m.id}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-night/40 py-2 text-name font-black"
            >
              {byId.get(m.homeEntryId!)?.player.name}
              <span className="text-title !text-[16px] text-accent">VS</span>
              {byId.get(m.awayEntryId!)?.player.name}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function HomePage() {
  const [data, admin, myId] = await Promise.all([
    getData(),
    isAdmin(),
    currentPlayerId(),
  ]);
  const views = allEditionViews(data);
  const open =
    views.find((v) => v.edition.status === "andamento") ??
    views.find((v) => v.edition.status === "inscricoes");
  const champions = views.flatMap((v) => {
    const entry = v.entries.find((e) => e.result === "campeao");
    return entry ? [{ edition: v.edition, entry }] : [];
  });
  const ranking = computeRanking(data).filter((r) => r.participations > 0);
  const records = recordItems(computeRecords(data));
  // Mesma moldura da carta do jogador (campeão, esmeralda ou rubi, pelos títulos).
  const tierById = new Map(
    ranking.map((r) => [r.player.id, tierOf(r.bestResult, r.titles)]),
  );
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
        <Section title="Campeões" reveal>
          {/* Faixa de cartas: do campeão mais recente para o mais antigo. */}
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none]">
            {champions.map(({ edition, entry }, i) => (
              <Link
                key={edition.id}
                href={`/edicoes/${edition.id}`}
                style={{ "--i": Math.min(i, 8) } as CSSProperties}
                className={`player-card tier-${tierById.get(entry.playerId) ?? "campeao"} ${i === 0 ? "champ-latest" : "anim-pop"} w-[88px] shrink-0 !gap-1 !px-1.5`}
              >
                <Avatar
                  name={entry.player.name}
                  photoUrl={entry.player.photoUrl}
                  avatar={entry.player.avatar}
                  size={64}
                />
                <span className="text-title w-full truncate text-center !text-[15px]">
                  {entry.player.name}
                </span>
                <span className="num rounded-full bg-night/80 px-2 text-[12px] font-black text-accent">
                  #{edition.number}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {records.length > 0 && (
        <Section title="Resenha" reveal>
          <RecordsTeaser items={records} />
        </Section>
      )}

      {ranking.length > 0 && (
        <Section
          reveal
          title="Ranking"
          aside={
            <Link href="/ranking" className="flex items-center gap-0.5">
              Ver completo
              <ChevronIcon width={16} height={16} />
            </Link>
          }
        >
          <div className="lb-list">
            {ranking.slice(0, 5).map((r, i) => (
              <LeaderRow
                key={r.player.id}
                index={i}
                place={i + 1}
                href={`/jogadores/${r.player.id}`}
                me={myId === r.player.id}
                media={
                  <PlayerMedia
                    name={r.player.name}
                    photoUrl={r.player.photoUrl}
                    avatar={r.player.avatar}
                    tier={tierOf(r.bestResult, r.titles)}
                  />
                }
                name={r.player.name}
                sub={[
                  r.finals ? plural(r.finals, "final", "finais") : "",
                  plural(r.participations, "edição", "edições"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={<span className="num">{r.titles}</span>}
                unit={r.titles === 1 ? "título" : "títulos"}
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

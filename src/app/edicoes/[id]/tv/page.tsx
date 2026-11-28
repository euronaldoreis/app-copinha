import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { TeamShield } from "@/components/TeamShield";
import { TvShell } from "@/components/TvShell";
import type { Match } from "@/db/schema";
import { getData } from "@/lib/data";
import { sourceLabel } from "@/lib/labels";
import { editionView, type EntryView } from "@/lib/services";
import {
  groupStageComplete,
  hasScore,
  knockoutRounds,
  playOrder,
  standingsByGroup,
} from "@/lib/tournament";

export const metadata: Metadata = { title: "TV da edição" };

type Seq = ReturnType<typeof playOrder<Match>>[number];

const two = (n: number) => String(n).padStart(2, "0");
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Jogador de um lado do jogo: cartão, nome e time. */
function Player({
  entry,
  placeholder,
  useTeams,
  big = false,
}: {
  entry: EntryView | undefined;
  placeholder: string;
  useTeams: boolean;
  big?: boolean;
}) {
  if (!entry)
    return (
      <div className="edition-tv-side is-empty">
        <span className="edition-tv-unknown">?</span>
        <span className="edition-tv-name">{placeholder}</span>
      </div>
    );
  return (
    <div className={`edition-tv-side ${big ? "is-big" : ""}`}>
      <span className="edition-tv-face">
        <Avatar
          name={entry.player.name}
          photoUrl={entry.player.photoUrl}
          avatar={entry.player.avatar}
          size={big ? 160 : 64}
        />
      </span>
      <span className="edition-tv-name">{entry.player.name}</span>
      {useTeams && entry.team && (
        <span className="edition-tv-team">
          <TeamShield team={entry.team.name} size={big ? 34 : 22} />
          <span className="truncate">{entry.team.name}</span>
        </span>
      )}
    </div>
  );
}

/** Linha compacta de um jogo: número, fase, os dois lados e o placar. */
function MatchRow({
  item,
  entryById,
  useTeams,
  placeholder,
  fresh = false,
}: {
  item: Seq;
  entryById: Map<number, EntryView>;
  useTeams: boolean;
  placeholder: (source: string | null) => string;
  fresh?: boolean;
}) {
  const m = item.match;
  const home = m.homeEntryId != null ? entryById.get(m.homeEntryId) : undefined;
  const away = m.awayEntryId != null ? entryById.get(m.awayEntryId) : undefined;
  const played = hasScore(m);
  const ahead = played
    ? m.homeScore! - m.awayScore! || (m.homePens ?? 0) - (m.awayPens ?? 0)
    : 0;
  const name = (e: EntryView | undefined, src: string | null, dim: boolean) => (
    <span className={`edition-tv-row-name ${dim ? "is-dim" : ""}`}>
      {e && useTeams && e.team && <TeamShield team={e.team.name} size={22} />}
      <span className="truncate">{e ? e.player.name : placeholder(src)}</span>
    </span>
  );
  return (
    <li className={`edition-tv-row ${fresh ? "anim-pop is-fresh" : ""}`}>
      <span className="edition-tv-row-tag">
        Jogo {two(item.number)} · {item.label}
      </span>
      <span className="edition-tv-row-match">
        {name(home, m.homeSource, ahead < 0)}
        <span className="edition-tv-row-score num">
          {played ? (
            <>
              {m.homeScore} : {m.awayScore}
              {m.homePens != null && m.awayPens != null && (
                <small>
                  {" "}
                  ({m.homePens}–{m.awayPens})
                </small>
              )}
            </>
          ) : (
            "x"
          )}
        </span>
        {name(away, m.awaySource, ahead > 0)}
      </span>
    </li>
  );
}

/**
 * TV da edição: o jogo da vez em destaque, os próximos da fila, o último
 * resultado e a classificação (ou o mata-mata). Atualiza sozinha enquanto o
 * admin lança os placares pelo celular. Só mostra; não precisa de login.
 */
export default async function EditionTvPage(
  props: PageProps<"/edicoes/[id]/tv">,
) {
  const { id } = await props.params;
  const data = await getData();
  const view = /^\d+$/.test(id) ? editionView(data, Number(id)) : null;
  if (!view || view.edition.format === "manual") notFound();
  const { edition, entries, matches } = view;
  const useTeams = edition.useTeams;
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const totalRounds = knockoutRounds(matches);
  const placeholder = (src: string | null) =>
    sourceLabel(src, edition.format, totalRounds);

  const seq = playOrder(edition.format, matches);
  const ready = seq.filter(
    (s) =>
      !hasScore(s.match) &&
      s.match.homeEntryId != null &&
      s.match.awayEntryId != null,
  );
  const current = ready[0];
  const upcoming = ready.slice(1, 4);
  // ainda sem os dois lados (ex.: final esperando a semifinal)
  const waiting = seq.filter(
    (s) => !hasScore(s.match) && !ready.includes(s),
  ).length;
  const played = seq.filter((s) => hasScore(s.match));
  const last = [...played].sort(
    (a, b) =>
      (b.match.playedAt ?? "").localeCompare(a.match.playedAt ?? "") ||
      b.number - a.number,
  )[0];

  const champion = entries.find((e) => e.result === "campeao");
  const vice = entries.find((e) => e.result === "vice");
  const finished = edition.status === "encerrada" || champion != null;

  // Lado direito: a classificação até acabar a fase de grupos; depois, o mata-mata.
  const groupMatches = matches.filter((m) => m.stage === "grupo");
  const knockout = seq.filter((s) => s.match.stage !== "grupo");
  const showTables =
    groupMatches.length > 0 &&
    (!groupStageComplete(matches) || knockout.length === 0);
  const tables = groupMatches.length ? standingsByGroup(entries, matches) : [];
  const direct = edition.qualifiers - edition.playoffs;
  const advancing =
    edition.qualifiers === 0
      ? 1
      : tables.length
        ? Math.floor(direct / tables.length)
        : 0;

  const renderTable = (t: (typeof tables)[number], title: string) => (
    <section key={t.label} className="edition-tv-table">
      <h2 className="edition-tv-heading">{title}</h2>
      <table>
        <thead>
          <tr>
            <th aria-label="Posição" />
            <th className="text-left">Jogador</th>
            <th title="Pontos">P</th>
            <th title="Jogos">J</th>
            <th title="Saldo de gols">SG</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => {
            const e = entryById.get(r.entryId)!;
            return (
              <tr key={r.entryId} className={i < advancing ? "is-in" : ""}>
                <td className="edition-tv-pos num">{i + 1}</td>
                <td className="edition-tv-who">
                  <span>
                    {useTeams && e.team && (
                      <TeamShield team={e.team.name} size={24} />
                    )}
                    <span className="truncate">{e.player.name}</span>
                  </span>
                </td>
                <td className="num font-black">{r.points}</td>
                <td className="num">{r.played}</td>
                <td className="num">{signed(r.gd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );

  const kicker =
    edition.status === "inscricoes"
      ? "Em breve"
      : finished
        ? "Fim de jogo"
        : `Ao vivo · ${played.length} de ${seq.length} jogos`;

  return (
    <TvShell
      kicker={kicker}
      title={edition.name}
      exitHref={`/edicoes/${edition.id}`}
      live={!finished}
    >
      {edition.status === "inscricoes" ? (
        <p className="choice-tv-event is-idle">
          A tabela aparece aqui assim que a edição começar.
        </p>
      ) : (
        <div className="edition-tv">
          <div className="edition-tv-main">
            {finished && champion ? (
              <section
                key="campeao"
                className="edition-tv-now is-champion anim-pop"
              >
                <p className="edition-tv-label">Campeão</p>
                <Player
                  entry={champion}
                  placeholder=""
                  useTeams={useTeams}
                  big
                />
                {vice && (
                  <p className="edition-tv-vice">
                    Vice: <b>{vice.player.name}</b>
                  </p>
                )}
              </section>
            ) : current ? (
              <section
                key={current.match.id}
                className="edition-tv-now anim-pop"
              >
                <p className="edition-tv-label">
                  Jogando agora · Jogo {two(current.number)} · {current.label}
                </p>
                <div className="edition-tv-versus">
                  <Player
                    entry={entryById.get(current.match.homeEntryId!)}
                    placeholder=""
                    useTeams={useTeams}
                    big
                  />
                  <span className="edition-tv-vs">VS</span>
                  <Player
                    entry={entryById.get(current.match.awayEntryId!)}
                    placeholder=""
                    useTeams={useTeams}
                    big
                  />
                </div>
              </section>
            ) : (
              <section className="edition-tv-now">
                <p className="edition-tv-label">Aguardando</p>
                <p className="edition-tv-wait">
                  {waiting > 0
                    ? "Os próximos jogos dependem dos resultados."
                    : "Nenhum jogo na fila."}
                </p>
              </section>
            )}

            <div className="edition-tv-lists">
              {last && (
                <section>
                  <h2 className="edition-tv-heading">Último resultado</h2>
                  <ul>
                    <MatchRow
                      key={`${last.match.id}:${last.match.homeScore}:${last.match.awayScore}`}
                      item={last}
                      entryById={entryById}
                      useTeams={useTeams}
                      placeholder={placeholder}
                      fresh
                    />
                  </ul>
                </section>
              )}
              {!finished && upcoming.length > 0 && (
                <section>
                  <h2 className="edition-tv-heading">Próximos</h2>
                  <ul>
                    {upcoming.map((s) => (
                      <MatchRow
                        key={s.match.id}
                        item={s}
                        entryById={entryById}
                        useTeams={useTeams}
                        placeholder={placeholder}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <aside className="edition-tv-side-col">
            {showTables ? (
              tables.map((t) =>
                renderTable(
                  t,
                  tables.length > 1 ? `Grupo ${t.label}` : "Classificação",
                ),
              )
            ) : (
              <>
                <section className="edition-tv-table">
                  <h2 className="edition-tv-heading">Mata-mata</h2>
                  <ul>
                    {knockout.map((s) => (
                      <MatchRow
                        key={s.match.id}
                        item={s}
                        entryById={entryById}
                        useTeams={useTeams}
                        placeholder={placeholder}
                      />
                    ))}
                  </ul>
                </section>
                {/* liga com final: a tabela continua valendo a pena */}
                {tables.length === 1 &&
                  renderTable(tables[0], "Classificação da liga")}
              </>
            )}
          </aside>
        </div>
      )}
    </TvShell>
  );
}

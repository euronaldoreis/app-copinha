import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/Avatar";
import { ShuffleIcon } from "@/components/icons";
import { CountUp } from "@/components/RecordsBoard";
import { RivalryShare } from "@/components/RivalryShare";
import { TeamShield } from "@/components/TeamShield";
import { Disclosure, PageTitle, Section } from "@/components/ui";
import type { Player } from "@/db/schema";
import { formatDate, plural } from "@/lib/labels";
import type { Rivalry, RivalryGame } from "@/lib/stats";
import { loadRivalry, rivalryHref, rivalrySummary, sortedPlayers } from "../../load";
import { Picker } from "../../Picker";

type Props = PageProps<"/confronto/[a]/[b]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { a, b } = await props.params;
  const loaded = await loadRivalry(a, b);
  if (!loaded) return { title: "Confronto" };
  const title = `${loaded.a.name} x ${loaded.b.name}`;
  const description = rivalrySummary(loaded.a, loaded.b, loaded.rivalry);
  return { title, description, openGraph: { title: `Confronto: ${title}`, description } };
}

/** Frase do momento do duelo, de quem está na frente. */
function verdict(a: Player, b: Player, r: Rivalry) {
  const { wins, losses, played } = r.record;
  if (played === 0) return "";
  if (wins === losses) return "Confronto equilibrado";
  const [leader, lead] = wins > losses ? [a, wins - losses] : [b, losses - wins];
  const share = Math.max(wins, losses) / played;
  return lead >= 3 || share >= 0.7 ? `${leader.name} domina o confronto` : `${leader.name} leva vantagem`;
}

/** Momento: a sequência mais recente. */
function streakText(a: Player, b: Player, r: Rivalry) {
  const s = r.streak;
  if (!s) return "";
  if (s.who === "empate") return s.count === 1 ? "O último jogo foi empate" : `${s.count} empates seguidos`;
  const who = s.who === "a" ? a.name : b.name;
  return s.count === 1 ? `${who} venceu o último jogo` : `${who} venceu os últimos ${s.count}`;
}

/** Resultado de um jogo do ponto de vista de A: V, E ou D. */
const outcome = (g: RivalryGame) => (g.winner === "a" ? "V" : g.winner === "b" ? "D" : "E");

/** Uma linha da comparação: valor de cada lado e as barras saindo do centro. */
function CompareRow({
  label,
  a,
  b,
  aText,
  bText,
  i,
}: {
  label: string;
  a: number;
  b: number;
  aText?: string;
  bText?: string;
  i: number;
}) {
  const total = a + b || 1;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
  return (
    <li className="rivalry-compare-row anim-row" style={{ "--i": i } as CSSProperties}>
      <span className={`rivalry-compare-val ${a > b ? "is-lead" : ""}`}>{aText ?? fmt(a)}</span>
      <span className="rivalry-compare-label">{label}</span>
      <span className={`rivalry-compare-val is-b ${b > a ? "is-lead" : ""}`}>{bText ?? fmt(b)}</span>
      <span className="rivalry-compare-bars" aria-hidden="true">
        <span className="rivalry-compare-bar is-a">
          <span style={{ "--w": `${(a / total) * 100}%`, "--i": i } as CSSProperties} />
        </span>
        <span className="rivalry-compare-bar is-b">
          <span style={{ "--w": `${(b / total) * 100}%`, "--i": i } as CSSProperties} />
        </span>
      </span>
    </li>
  );
}

function Score({ game }: { game: RivalryGame }) {
  return (
    <>
      {game.aScore} : {game.bScore}
      {game.aPens != null && game.bPens != null && (
        <small className="ml-1 text-[12px] text-muted">
          (pên. {game.aPens}–{game.bPens})
        </small>
      )}
    </>
  );
}

export default async function RivalryPage(props: Props) {
  const params = await props.params;
  const [loaded, players] = await Promise.all([loadRivalry(params.a, params.b), sortedPlayers()]);
  if (!loaded) notFound();
  const { a, b, rivalry } = loaded;
  const { record, games, biggest, knockouts, finals } = rivalry;
  const total = record.played || 1;
  const share = (n: number) => `${(n / total) * 100}%`;
  const margin = (g: RivalryGame | null) => (g ? Math.abs(g.aScore - g.bScore) : 0);
  const bigText = (g: RivalryGame | null, side: "a" | "b") =>
    g ? (side === "a" ? `${g.aScore} a ${g.bScore}` : `${g.bScore} a ${g.aScore}`) : "–";

  const rows: { label: string; a: number; b: number; aText?: string; bText?: string }[] = [
    { label: "Vitórias", a: record.wins, b: record.losses },
    { label: "Gols marcados", a: record.gf, b: record.ga },
    { label: "Gols por jogo", a: record.gf / total, b: record.ga / total },
    {
      label: "Maior vitória",
      a: margin(biggest.a),
      b: margin(biggest.b),
      aText: bigText(biggest.a, "a"),
      bText: bigText(biggest.b, "b"),
    },
  ];
  if (knockouts.a + knockouts.b > 0)
    rows.push({ label: "Passou no mata-mata", a: knockouts.a, b: knockouts.b });
  if (finals.a + finals.b > 0) rows.push({ label: "Finais vencidas", a: finals.a, b: finals.b });

  const hero = (p: Player, wins: number, side: "a" | "b") => (
    <Link
      href={`/jogadores/${p.id}`}
      className={`rivalry-hero-side ${side === "a" ? "slide-from-left" : "slide-from-right"}`}
    >
      <Avatar name={p.name} photoUrl={p.photoUrl} avatar={p.avatar} size={84} />
      <span className="rivalry-hero-name">{p.name}</span>
      <span className="sr-only">{plural(wins, "vitória", "vitórias")}</span>
    </Link>
  );

  return (
    <>
      <PageTitle
        title="Confronto"
        subtitle={`${a.name} x ${b.name}`}
        action={
          <Link
            href={rivalryHref(b.id, a.id)}
            className="btn btn-icon"
            title="Inverter os lados"
            aria-label="Inverter os lados"
          >
            <ShuffleIcon width={22} height={22} />
          </Link>
        }
      />

      <section className="rivalry-hero" aria-label={rivalrySummary(a, b, rivalry)}>
        <p className="rivalry-hero-kicker">Confronto direto</p>
        <div className="rivalry-hero-row">
          {hero(a, record.wins, "a")}
          <div className="rivalry-hero-score" aria-hidden="true">
            <span className="rivalry-hero-num">
              <CountUp value={record.wins} run />
            </span>
            <span className="rivalry-hero-x vs-pulse">x</span>
            <span className="rivalry-hero-num is-b">
              <CountUp value={record.losses} run />
            </span>
            <span className="rivalry-hero-caption">vitórias</span>
          </div>
          {hero(b, record.losses, "b")}
        </div>

        {record.played > 0 ? (
          <>
            <p className="rivalry-hero-sub">
              {plural(record.draws, "empate", "empates")} · {plural(record.played, "jogo", "jogos")}
            </p>
            <div className="rivalry-bar" role="img" aria-label={`${a.name} ${record.wins}, empates ${record.draws}, ${b.name} ${record.losses}`}>
              <span className="rivalry-bar-a" style={{ width: share(record.wins) }} />
              <span className="rivalry-bar-d" style={{ width: share(record.draws) }} />
              <span className="rivalry-bar-b" style={{ width: share(record.losses) }} />
            </div>
            <p className="rivalry-verdict anim-pop" style={{ "--i": 8 } as CSSProperties}>
              {verdict(a, b, rivalry)}
            </p>
            <p className="rivalry-streak">{streakText(a, b, rivalry)}</p>
            <div className="rivalry-form">
              <span className="rivalry-form-label">Últimos jogos de {a.name}</span>
              <ol className="rivalry-form-list" aria-label={`Últimos jogos de ${a.name}, do mais recente`}>
                {games.slice(0, 5).map((g, i) => (
                  <li
                    key={g.matchId}
                    className={`rivalry-form-chip is-${outcome(g)} anim-pop`}
                    style={{ "--i": 9 + i } as CSSProperties}
                    title={`${g.edition.name} · ${g.aScore} x ${g.bScore}`}
                  >
                    {outcome(g)}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <p className="rivalry-hero-sub">
            {a.name} e {b.name} ainda não se enfrentaram.
          </p>
        )}

        <div className="mt-4 flex justify-center">
          <RivalryShare text={`${rivalrySummary(a, b, rivalry)} na Copinha dos Lixos!`} fileName={`confronto-${a.name}-${b.name}`} />
        </div>
      </section>

      {record.played > 0 && (
        <>
          <Section title="Comparação" reveal>
            <div className="card px-4 py-4">
              <div className="rivalry-compare-head">
                <span>{a.name}</span>
                <span className="is-b">{b.name}</span>
              </div>
              <ul className="flex flex-col gap-3.5">
                {rows.map((r, i) => (
                  <CompareRow key={r.label} {...r} i={i} />
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Jogos" aside={plural(games.length, "jogo", "jogos")} reveal>
            <ul className="flex flex-col gap-2">
              {games.map((g, i) => (
                <li key={g.matchId} className="anim-row" style={{ "--i": Math.min(i, 12) } as CSSProperties}>
                  <Link
                    href={`/edicoes/${g.edition.id}`}
                    className={`rivalry-game card is-${outcome(g)}`}
                  >
                    <span className="rivalry-game-tag">
                      <span className="truncate">
                        {g.edition.name} · {g.label}
                      </span>
                      <span className="shrink-0">{formatDate(g.edition.playedOn)}</span>
                    </span>
                    <span className={`rivalry-game-side ${g.winner === "a" ? "is-win" : ""}`}>
                      {g.aTeam && <TeamShield team={g.aTeam} size={22} />}
                      <span className="truncate">{g.aTeam ?? a.name}</span>
                    </span>
                    <span className="rivalry-game-score num">
                      <Score game={g} />
                    </span>
                    <span className={`rivalry-game-side is-b ${g.winner === "b" ? "is-win" : ""}`}>
                      {g.bTeam && <TeamShield team={g.bTeam} size={22} />}
                      <span className="truncate">{g.bTeam ?? b.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section title="Outro confronto">
        <Disclosure title="Escolher outros jogadores">
          <Picker players={players} a={a.id} b={b.id} />
        </Disclosure>
      </Section>
    </>
  );
}

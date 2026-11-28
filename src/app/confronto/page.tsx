import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Empty, PageTitle, Section } from "@/components/ui";
import type { Player } from "@/db/schema";
import { getData } from "@/lib/data";
import { formatDate, plural } from "@/lib/labels";
import { computeRivalry, pct, type RivalryGame } from "@/lib/stats";

export const metadata: Metadata = { title: "Confronto" };

const idOf = (v: string | string[] | undefined) =>
  typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null;

/** Escolha dos dois jogadores: um formulário simples, o endereço guarda o par. */
function Picker({ players, a, b }: { players: Player[]; a: number | null; b: number | null }) {
  const select = (name: string, value: number | null, label: string) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field" required>
        <option value="" disabled>
          Escolha
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form method="get" className="card flex flex-col gap-4 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        {select("a", a, "Jogador")}
        <span className="pb-3 font-pixel text-[18px] text-muted">X</span>
        {select("b", b, "Adversário")}
      </div>
      <button type="submit" className="btn btn-primary w-full">
        Ver confronto
      </button>
    </form>
  );
}

function Score({ game, flip = false }: { game: RivalryGame; flip?: boolean }) {
  const [l, r] = flip ? [game.bScore, game.aScore] : [game.aScore, game.bScore];
  const pens =
    game.aPens != null && game.bPens != null
      ? flip
        ? `${game.bPens}–${game.aPens}`
        : `${game.aPens}–${game.bPens}`
      : null;
  return (
    <>
      {l} : {r}
      {pens && <span className="ml-1 text-[12px] text-muted">(pên. {pens})</span>}
    </>
  );
}

export default async function RivalryPage(props: PageProps<"/confronto">) {
  const params = await props.searchParams;
  const data = await getData();
  const players = [...data.players].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  const aId = idOf(params.a);
  const bId = idOf(params.b);
  const a = players.find((p) => p.id === aId);
  const b = players.find((p) => p.id === bId);

  const picker = <Picker players={players} a={a?.id ?? null} b={b?.id ?? null} />;
  if (!a || !b || a.id === b.id) {
    return (
      <>
        <PageTitle title="Confronto" subtitle="O retrospecto entre dois jogadores" />
        {picker}
        {a && b && <p className="mt-3 text-body text-muted">Escolha dois jogadores diferentes.</p>}
      </>
    );
  }

  const rivalry = computeRivalry(data, a.id, b.id);
  const { record, games, biggest, knockouts, finals, streak } = rivalry;
  const total = record.played || 1;
  const share = (n: number) => `${(n / total) * 100}%`;
  const nameOf = (side: "a" | "b") => (side === "a" ? a.name : b.name);

  const facts: { label: string; value: string }[] = [];
  if (streak) {
    facts.push({
      label: "Momento",
      value:
        streak.who === "empate"
          ? streak.count === 1
            ? "Empataram o último jogo"
            : `Empataram os últimos ${streak.count}`
          : streak.count === 1
            ? `${nameOf(streak.who)} venceu o último`
            : `${nameOf(streak.who)} venceu os últimos ${streak.count}`,
    });
  }
  for (const side of ["a", "b"] as const) {
    const g = biggest[side];
    if (!g) continue;
    facts.push({
      label: `Maior vitória de ${nameOf(side)}`,
      value: `${side === "a" ? `${g.aScore} a ${g.bScore}` : `${g.bScore} a ${g.aScore}`} · ${g.edition.name}`,
    });
  }
  if (knockouts.a + knockouts.b > 0) {
    const parts = (["a", "b"] as const)
      .filter((s) => knockouts[s] > 0)
      .map((s) => `${nameOf(s)} ${knockouts[s]}`);
    facts.push({ label: "Mata-mata (quem passou)", value: parts.join(" · ") });
  }
  if (finals.a + finals.b > 0) {
    const parts = (["a", "b"] as const)
      .filter((s) => finals[s] > 0)
      .map((s) => `${nameOf(s)} ${finals[s]}`);
    facts.push({ label: "Finais (quem levou)", value: parts.join(" · ") });
  }

  const side = (p: Player, wins: number, color: string) => (
    <Link
      href={`/jogadores/${p.id}`}
      className="flex min-w-0 flex-col items-center gap-2 text-center"
      aria-label={`${p.name}: ${plural(wins, "vitória", "vitórias")}`}
    >
      <Avatar name={p.name} photoUrl={p.photoUrl} avatar={p.avatar} size={72} />
      <span className="max-w-full truncate text-name font-black">{p.name}</span>
      <span className={`num text-outline font-pixel text-[40px] leading-none ${color}`}>
        {wins}
      </span>
      <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
        {wins === 1 ? "vitória" : "vitórias"}
      </span>
    </Link>
  );

  return (
    <>
      <PageTitle title="Confronto" subtitle={`${a.name} x ${b.name}`} />
      {picker}

      {games.length === 0 ? (
        <div className="mt-6">
          <Empty>
            {a.name} e {b.name} ainda não se enfrentaram.
          </Empty>
        </div>
      ) : (
        <>
          <Section title="Retrospecto">
            <div className="card px-4 pb-5 pt-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                {side(a, record.wins, "text-accent")}
                <div className="flex flex-col items-center gap-1 pt-6">
                  <span className="font-pixel text-[22px] text-muted">VS</span>
                  <span className="num text-outline font-pixel text-[26px] leading-none">
                    {record.draws}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
                    {record.draws === 1 ? "empate" : "empates"}
                  </span>
                </div>
                {side(b, record.losses, "text-[#4fb6ff]")}
              </div>

              {/* barra de domínio: vitórias de A, empates, vitórias de B */}
              <div
                className="rivalry-bar mt-5"
                role="img"
                aria-label={`${a.name} ${record.wins}, empates ${record.draws}, ${b.name} ${record.losses}`}
              >
                <span className="rivalry-bar-a" style={{ width: share(record.wins) }} />
                <span className="rivalry-bar-d" style={{ width: share(record.draws) }} />
                <span className="rivalry-bar-b" style={{ width: share(record.losses) }} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[12px] font-bold text-muted">Jogos</dt>
                  <dd className="num text-name font-black">{record.played}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-bold text-muted">Gols</dt>
                  <dd className="num text-name font-black">
                    {record.gf} – {record.ga}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-bold text-muted">
                    Aproveit. de {a.name}
                  </dt>
                  <dd className="num text-name font-black">{pct(record)}%</dd>
                </div>
              </dl>
            </div>

            {facts.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {facts.map((f) => (
                  <li key={f.label} className="card flex flex-col gap-0.5 px-4 py-3">
                    <span className="text-[13px] font-bold text-muted">{f.label}</span>
                    <span className="text-name font-black">{f.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Jogos" aside={plural(games.length, "jogo", "jogos")}>
            <ul className="flex flex-col gap-2">
              {games.map((g) => (
                <li key={g.matchId}>
                  <Link
                    href={`/edicoes/${g.edition.id}`}
                    className="card grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3"
                  >
                    <span className="col-span-3 flex items-baseline justify-between gap-2 text-[13px] font-bold text-muted">
                      <span className="truncate">
                        {g.edition.name} · {g.label}
                      </span>
                      <span className="shrink-0">{formatDate(g.edition.playedOn)}</span>
                    </span>
                    <span
                      className={`min-w-0 truncate text-left text-name ${g.winner === "a" ? "font-black" : "font-semibold text-muted"}`}
                    >
                      {g.aTeam ?? a.name}
                    </span>
                    <span className="num whitespace-nowrap font-pixel text-[18px]">
                      <Score game={g} />
                    </span>
                    <span
                      className={`min-w-0 truncate text-right text-name ${g.winner === "b" ? "font-black" : "font-semibold text-muted"}`}
                    >
                      {g.bTeam ?? b.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}

import type { EntryView } from "@/lib/services";
import type { StandingRow } from "@/lib/tournament";
import { LeaderRow, PlayerMedia } from "./Leaderboard";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Classificação de um grupo: faixa com o nome do grupo e a regra, e o mesmo
 * card de jogador das outras listas (brasão verde para quem avança).
 */
export function StandingsTable({
  rows,
  entries,
  qualifying,
  title,
  note,
  tiers,
}: {
  rows: StandingRow[];
  entries: Map<number, EntryView>;
  /** Quantos primeiros colocados avançam (brasão verde). */
  qualifying: number;
  /** Nome na faixa de cima (ex.: "Grupo A"). */
  title: string;
  /** Regra na faixa de cima, em dourado (ex.: "Os 2 primeiros avançam"). */
  note?: string;
  /** Categoria de cada jogador (moldura do retrato), pelo id do jogador. */
  tiers?: Map<number, string>;
}) {
  return (
    <section aria-label={title}>
      <header className="group-head">
        <h3 className="font-pixel text-[20px] uppercase leading-none">
          {title}
        </h3>
        {note && (
          <span className="text-right text-[12px] font-black uppercase tracking-wider text-accent">
            {note}
          </span>
        )}
      </header>
      <div className="lb-list mt-2.5">
        {rows.map((row, i) => {
          const entry = entries.get(row.entryId);
          if (!entry) return null;
          return (
            <LeaderRow
              key={row.entryId}
              index={i}
              place={i + 1}
              badge={i < qualifying ? "up" : "plain"}
              href={`/jogadores/${entry.playerId}`}
              media={
                <PlayerMedia
                  name={entry.player.name}
                  photoUrl={entry.player.photoUrl}
                  avatar={entry.player.avatar}
                  tier={tiers?.get(entry.playerId) ?? "participou"}
                />
              }
              name={entry.player.name}
              sub={[entry.team?.name, `${row.played}J`, `SG ${signed(row.gd)}`]
                .filter(Boolean)
                .join(" · ")}
              value={<span className="num">{row.points}</span>}
              unit={row.points === 1 ? "ponto" : "pontos"}
            />
          );
        })}
      </div>
    </section>
  );
}

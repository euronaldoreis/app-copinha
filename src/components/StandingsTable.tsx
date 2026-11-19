import type { CSSProperties } from "react";
import Link from "next/link";
import type { EntryView } from "@/lib/services";
import type { StandingRow } from "@/lib/tournament";
import { Avatar } from "./Avatar";

const wide = "hidden sm:table-cell";
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Classificação de um grupo, no estilo de placar de jogo: faixa com o nome
 * do grupo e a regra, e uma linha por jogador com a posição em círculo
 * (verde para quem avança). No celular ficam só pontos, jogos e saldo.
 */
export function StandingsTable({
  rows,
  entries,
  qualifying,
  title,
  note,
}: {
  rows: StandingRow[];
  entries: Map<number, EntryView>;
  /** Quantos primeiros colocados avançam (círculo verde). */
  qualifying: number;
  /** Nome na faixa de cima (ex.: "Grupo A"). */
  title: string;
  /** Regra na faixa de cima, em dourado (ex.: "Os 2 primeiros avançam"). */
  note?: string;
}) {
  return (
    <section className="group-card" aria-label={title}>
      <header className="group-card-head">
        <h3 className="font-pixel text-[20px] uppercase leading-none">
          {title}
        </h3>
        {note && (
          <span className="text-right text-[12px] font-black uppercase tracking-wider text-accent">
            {note}
          </span>
        )}
      </header>
      <table className="group-table w-full text-body">
        <thead>
          <tr>
            <th className="w-12 text-center" title="Posição">
              #
            </th>
            <th className="text-left">Jogador</th>
            <th title="Pontos">P</th>
            <th title="Jogos">J</th>
            <th className={wide} title="Vitórias">
              V
            </th>
            <th className={wide} title="Empates">
              E
            </th>
            <th className={wide} title="Derrotas">
              D
            </th>
            <th className={wide} title="Gols pró">
              GP
            </th>
            <th className={wide} title="Gols contra">
              GC
            </th>
            <th title="Saldo de gols">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const entry = entries.get(row.entryId);
            if (!entry) return null;
            const up = i < qualifying;
            return (
              <tr
                key={row.entryId}
                className="anim-row"
                style={{ "--i": Math.min(i, 12) } as CSSProperties}
              >
                <td className="text-center">
                  <span
                    className={`group-pos ${up ? "group-pos-up" : ""}`}
                    title={up ? "Zona de classificação" : undefined}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="w-full max-w-0">
                  <Link
                    href={`/jogadores/${entry.playerId}`}
                    className="flex items-center gap-2.5"
                  >
                    <span className="group-avatar">
                      <Avatar
                        name={entry.player.name}
                        photoUrl={entry.player.photoUrl}
                        avatar={entry.player.avatar}
                        size={34}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-name font-black leading-tight">
                        {entry.player.name}
                      </span>
                      {entry.team && (
                        <span className="group-team block truncate text-[13px]">
                          {entry.team.name}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="num font-pixel !text-[20px]">{row.points}</td>
                <td className="num">{row.played}</td>
                <td className={`num ${wide}`}>{row.wins}</td>
                <td className={`num ${wide}`}>{row.draws}</td>
                <td className={`num ${wide}`}>{row.losses}</td>
                <td className={`num ${wide}`}>{row.gf}</td>
                <td className={`num ${wide}`}>{row.ga}</td>
                <td className="num font-black">{signed(row.gd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

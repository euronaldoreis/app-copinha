import Link from "next/link";
import type { EntryView } from "@/lib/services";
import type { StandingRow } from "@/lib/tournament";

const th = "px-1.5 pb-2 text-right font-normal";
const td = "num px-1.5 text-right";
const wide = "hidden sm:table-cell";

/** Classificação de um grupo. No celular ficam só pontos, jogos e saldo. */
export function StandingsTable({
  rows,
  entries,
  qualifying,
}: {
  rows: StandingRow[];
  entries: Map<number, EntryView>;
  /** Quantos primeiros colocados têm vaga direta (ganham o ponto de destaque). */
  qualifying: number;
}) {
  return (
    <table className="w-full text-body">
      <thead className="text-muted">
        <tr>
          <th className="w-14 pb-2 text-left font-normal">
            <span className="sr-only">Posição</span>
          </th>
          <th className="pb-2 text-left font-normal">Jogador</th>
          <th className={th} title="Pontos">P</th>
          <th className={th} title="Jogos">J</th>
          <th className={`${th} ${wide}`} title="Vitórias">V</th>
          <th className={`${th} ${wide}`} title="Empates">E</th>
          <th className={`${th} ${wide}`} title="Derrotas">D</th>
          <th className={`${th} ${wide}`} title="Gols pró">GP</th>
          <th className={`${th} ${wide}`} title="Gols contra">GC</th>
          <th className={th} title="Saldo de gols">SG</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const entry = entries.get(row.entryId);
          if (!entry) return null;
          return (
            <tr key={row.entryId} className="h-[52px]">
              <td className="num pl-4 pr-3 text-muted">
                <span className="flex items-center gap-1.5">
                  {i + 1}
                  {i < qualifying && (
                    <span
                      className="size-1.5 bg-accent"
                      title="Zona de classificação"
                    />
                  )}
                </span>
              </td>
              <td className="max-w-0 w-full">
                <Link href={`/jogadores/${entry.playerId}`} className="block">
                  <span className="block truncate text-name font-semibold">
                    {entry.player.name}
                  </span>
                  <span className="block truncate text-muted">
                    {entry.team?.name}
                  </span>
                </Link>
              </td>
              <td className={`${td} text-name font-semibold`}>{row.points}</td>
              <td className={td}>{row.played}</td>
              <td className={`${td} ${wide}`}>{row.wins}</td>
              <td className={`${td} ${wide}`}>{row.draws}</td>
              <td className={`${td} ${wide}`}>{row.losses}</td>
              <td className={`${td} ${wide}`}>{row.gf}</td>
              <td className={`${td} ${wide}`}>{row.ga}</td>
              <td className={td}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

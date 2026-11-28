import type { Player } from "@/db/schema";
import { getData } from "@/lib/data";
import { plural } from "@/lib/labels";
import { computeRivalry, type Rivalry } from "@/lib/stats";

const idOf = (v: string | string[] | undefined) =>
  typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null;

/** Todos os jogadores por nome, para a escolha do par. */
export async function sortedPlayers() {
  const data = await getData();
  return [...data.players].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
}

/** O par do endereço e o retrospecto entre eles (null se o par não vale). */
export async function loadRivalry(rawA: string | string[] | undefined, rawB: string | string[] | undefined) {
  const data = await getData();
  const a = data.players.find((p) => p.id === idOf(rawA));
  const b = data.players.find((p) => p.id === idOf(rawB));
  if (!a || !b || a.id === b.id) return null;
  return { a, b, rivalry: computeRivalry(data, a.id, b.id) };
}

export { idOf };
export type { Player };

/** Endereço do confronto entre dois jogadores. */
export const rivalryHref = (a: number, b: number) => `/confronto/${a}/${b}`;

/** "Brando 3 x 2 Paulo · 1 empate · 6 jogos" */
export function rivalrySummary(a: Player, b: Player, r: Rivalry) {
  const { wins, losses, draws, played } = r.record;
  if (played === 0) return `${a.name} e ${b.name} ainda não se enfrentaram`;
  return `${a.name} ${wins} x ${losses} ${b.name} · ${plural(draws, "empate", "empates")} · ${plural(played, "jogo", "jogos")}`;
}

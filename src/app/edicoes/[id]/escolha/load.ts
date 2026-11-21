import { getDb } from "@/db";
import { getData } from "@/lib/data";
import { editionView, listTeamChoices } from "@/lib/services";
import type { ChoicePlayer } from "@/components/TeamChoiceAdmin";

/** Edição, participantes e o que já foi citado e banido na escolha dos times. */
export async function loadChoice(id: string) {
  if (!/^\d+$/.test(id)) return null;
  const data = await getData();
  const view = editionView(data, Number(id));
  if (!view) return null;
  const players: ChoicePlayer[] = view.entries.map((e) => ({
    id: e.player.id,
    name: e.player.name,
    photoUrl: e.player.photoUrl,
    avatar: e.player.avatar,
  }));
  const choices = (await listTeamChoices(getDb(), view.edition.id)).map(
    ({ id, playerId, kind, team }) => ({ id, playerId, kind, team }),
  );
  const knownTeams = [
    ...new Set([...view.edition.teamPool, ...data.teams.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { edition: view.edition, players, choices, knownTeams };
}

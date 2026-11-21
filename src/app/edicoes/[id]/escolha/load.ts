import { getDb } from "@/db";
import { getData } from "@/lib/data";
import {
  choiceTurnOrder,
  drawReplay,
  editionView,
  listTeamChoices,
} from "@/lib/services";
import type { ChoicePlayer } from "@/components/TeamChoiceAdmin";

/**
 * Edição, participantes (na ordem da vez: colocação na edição anterior) e o
 * que já foi citado, banido e sorteado na escolha dos times.
 */
export async function loadChoice(id: string) {
  if (!/^\d+$/.test(id)) return null;
  const data = await getData();
  const view = editionView(data, Number(id));
  if (!view) return null;
  const { previous, order } = choiceTurnOrder(data, view.edition.id);
  const byPlayer = new Map(view.entries.map((e) => [e.playerId, e.player]));
  const players: ChoicePlayer[] = order.flatMap((playerId) => {
    const p = byPlayer.get(playerId);
    return p
      ? [{ id: p.id, name: p.name, photoUrl: p.photoUrl, avatar: p.avatar }]
      : [];
  });
  const choices = (await listTeamChoices(getDb(), view.edition.id)).map(
    ({ id, playerId, kind, team }) => ({ id, playerId, kind, team }),
  );
  const knownTeams = [
    ...new Set([...view.edition.teamPool, ...data.teams.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    edition: view.edition,
    /** Sorteio dos grupos, depois que a tabela foi gerada (null antes). */
    groups: drawReplay(data, view.edition.id),
    previousName: previous?.name ?? null,
    players,
    choices,
    knownTeams,
  };
}

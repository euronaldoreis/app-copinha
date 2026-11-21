import { describe, expect, it } from "vitest";
import { choiceState, turnOrder } from "@/lib/teamChoice";

describe("ordem da escolha dos times", () => {
  const people = [
    { playerId: 1, seed: 0 },
    { playerId: 2, seed: 1 },
    { playerId: 3, seed: 2 },
    { playerId: 4, seed: 3 },
    { playerId: 5, seed: 4 },
  ];

  it("segue a colocação na edição anterior; quem não jogou vai por último", () => {
    // anterior: 4 campeão, 2 vice, 9 (não está nesta), 1
    expect(turnOrder(people, [4, 2, 9, 1])).toEqual([4, 2, 1, 3, 5]);
  });

  it("sem edição anterior, vale a ordem de inscrição", () => {
    expect(turnOrder(people, [])).toEqual([1, 2, 3, 4, 5]);
  });

  it("cada um cita os 2 times seguidos e depois bane na mesma ordem", () => {
    const order = [3, 1, 2];
    let id = 0;
    const rows: { id: number; playerId: number; kind: string; team: string }[] = [];
    const add = (playerId: number, kind: string, team: string) =>
      rows.push({ id: ++id, playerId, kind, team });

    expect(choiceState(order, rows).turn).toBe(3);
    add(3, "escolha", "A");
    expect(choiceState(order, rows).turn).toBe(3);
    add(3, "escolha", "B");
    expect(choiceState(order, rows).turn).toBe(1);
    add(1, "escolha", "C");
    add(1, "escolha", "D");
    add(2, "escolha", "E");
    add(2, "escolha", "F");
    const ban = choiceState(order, rows);
    expect(ban.phase).toBe("banimento");
    expect(ban.turn).toBe(3);
    add(3, "veto", "C");
    expect(choiceState(order, rows).turn).toBe(1);
    add(1, "veto", "A");
    add(2, "veto", "F");
    const done = choiceState(order, rows);
    expect(done.phase).toBe("sorteio");
    expect(done.turn).toBeNull();
    expect(done.remaining).toEqual(["B", "D", "E"]);
  });
});

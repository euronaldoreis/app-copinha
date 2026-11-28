import { describe, expect, it } from "vitest";
import { playOrder } from "@/lib/tournament";

let id = 0;
const m = (stage: string, round: number, slot: number, groupLabel: string | null = null) => ({
  id: ++id,
  stage,
  round,
  slot,
  groupLabel,
});

describe("ordem dos jogos", () => {
  it("alterna os grupos em cada rodada e termina com 3º lugar antes da final", () => {
    const list = [
      m("mata", 2, 0),
      m("terceiro", 2, 0),
      m("mata", 1, 1),
      m("mata", 1, 0),
      m("grupo", 2, 0, "B"),
      m("grupo", 2, 0, "A"),
      m("grupo", 1, 1, "A"),
      m("grupo", 1, 0, "B"),
      m("grupo", 1, 0, "A"),
    ];
    const order = playOrder("grupos", list);
    expect(order.map((o) => `${o.number} ${o.label}`)).toEqual([
      "1 Grupo A",
      "2 Grupo B",
      "3 Grupo A",
      "4 Grupo A",
      "5 Grupo B",
      "6 Semifinal",
      "7 Semifinal",
      "8 Disputa de 3º lugar",
      "9 Final",
    ]);
    // semifinais pelo slot
    expect(order[5].match.slot).toBe(0);
  });

  it("na liga, a fase é a rodada", () => {
    const order = playOrder("liga", [m("grupo", 2, 0, "A"), m("grupo", 1, 0, "A")]);
    expect(order.map((o) => o.label)).toEqual(["Rodada 1", "Rodada 2"]);
  });
});

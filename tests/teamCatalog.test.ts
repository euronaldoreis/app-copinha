import { describe, expect, it } from "vitest";
import leagues from "../scripts/times.json";

const key = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

describe("catálogo de times do seed", () => {
  const entries = Object.entries(leagues as Record<string, string[]>);

  it("tem o número de clubes de cada liga", () => {
    const sizes = Object.fromEntries(entries.map(([l, t]) => [l, t.length]));
    expect(sizes).toEqual({
      "Brasileirão Série A 2026": 20,
      "Brasileirão Série B 2026": 20,
      "Brasileirão Série C 2026": 20,
      "Premier League 2026/27": 20,
      "Serie A (Itália) 2026/27": 20,
      "La Liga 2026/27": 20,
      "Liga Portugal 2026/27": 18,
      "Ligue 1 2026/27": 18,
      "Bundesliga 2026/27": 18,
      "Eredivisie 2026/27": 18,
      "Campeonato Argentino 2026": 30,
      "MLS 2026": 30,
    });
  });

  it("não repete nomes, nem entre ligas", () => {
    const all = entries.flatMap(([, t]) => t.map(key));
    expect(new Set(all).size).toBe(all.length);
  });

  it("usa nomes limpos que cabem no campo do time", () => {
    for (const [, teams] of entries)
      for (const name of teams) {
        expect(name).toBe(name.trim().replace(/\s+/g, " "));
        expect(name.length).toBeLessThanOrEqual(60);
      }
  });
});

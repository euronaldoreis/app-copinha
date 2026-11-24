import { describe, expect, it } from "vitest";
import leagues from "../scripts/times.json";
import { LEAGUES, fold } from "@/lib/apiFootball";

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
      "Liga Chilena 2026": 16,
      "Liga Paraguaia 2026": 12,
      "Liga Uruguaia 2026": 16,
      "Liga Venezuelana 2026": 14,
      "Liga Boliviana 2026": 16,
      "Liga Colombiana 2026": 20,
      "Liga Peruana 2026": 18,
      "Liga Equatoriana 2026": 16,
      "Liga MX 2026/27": 18,
    });
  });

  it("não repete nomes, nem entre ligas", () => {
    const all = entries.flatMap(([, t]) => t.map(key));
    expect(new Set(all).size).toBe(all.length);
  });

  it("não repete nomes nem ignorando acentos (a busca de escudos compara assim)", () => {
    const all = entries.flatMap(([, t]) => t.map(fold));
    expect(new Set(all).size).toBe(all.length);
  });

  it("toda liga do catálogo tem como achar os escudos na API", () => {
    for (const [league] of entries) expect(LEAGUES[league], league).toBeDefined();
  });

  it("usa nomes limpos que cabem no campo do time", () => {
    for (const [, teams] of entries)
      for (const name of teams) {
        expect(name).toBe(name.trim().replace(/\s+/g, " "));
        expect(name.length).toBeLessThanOrEqual(60);
      }
  });
});

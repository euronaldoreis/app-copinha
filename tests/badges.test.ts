import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb } from "@/db";
import { teams } from "@/db/schema";
import {
  ApiFootballError,
  bestMatch,
  currentSeason,
  rankCandidates,
  searchTeams,
  searchTerm,
  similarity,
  suggestedTerm,
  type BadgeCandidate,
} from "@/lib/apiFootball";
import { UserError, fillLeagueBadges, mergeTeams, setTeamBadge } from "@/lib/services";

const logo = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;
const team = (id: number, name: string, country: string): BadgeCandidate => ({
  id,
  name,
  country,
  logo: logo(id),
});

/** Resposta no formato da API-Football (erros vêm com status 200). */
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
const ok = (list: BadgeCandidate[]) =>
  reply({ errors: [], response: list.map((t) => ({ team: { ...t, national: false } })) });

describe("comparação de nomes", () => {
  it("limpa o termo de busca para o que a API aceita", () => {
    expect(searchTerm("São Paulo")).toBe("sao paulo");
    expect(searchTerm("Newell's Old Boys")).toBe("newell s old boys");
    expect(searchTerm("Botafogo-SP")).toBe("botafogo sp");
  });

  it("sugere o nome em inglês quando o daqui é em português", () => {
    expect(suggestedTerm("Bayern de Munique")).toBe("bayern munchen");
    expect(suggestedTerm("Colônia")).toBe("koln");
    expect(suggestedTerm("Íbis")).toBe("ibis");
  });

  it("ignora siglas e palavras de enfeite", () => {
    expect(similarity("Sevilla", "Sevilla FC")).toBe(1);
    expect(similarity("Arsenal", "Arsenal W")).toBeLessThan(1);
    expect(similarity("Ajax", "Feyenoord")).toBe(0);
  });

  it("prefere o time do país da liga do catálogo", () => {
    const list = [team(1, "Athletic Club", "Spain"), team(2, "Athletic Club", "Brazil")];
    expect(bestMatch("Athletic Club", list)?.id).toBe(2);
    expect(bestMatch("Athletic Bilbao", list)?.id).toBe(1);
  });

  it("deixa de fora times femininos e de base", () => {
    const list = [team(1, "Arsenal W", "England"), team(2, "Arsenal", "England")];
    expect(rankCandidates("Arsenal", list).map((c) => c.id)).toEqual([2]);
  });

  it("não escolhe sozinho quando a dúvida é grande", () => {
    const list = [team(1, "Nacional", "Uruguay"), team(2, "Nacional", "Paraguay")];
    expect(bestMatch("Nacional", list)).toBeNull();
  });

  it("aceita os times canadenses na MLS", () => {
    expect(bestMatch("Toronto FC", [team(9, "Toronto FC", "Canada")])?.id).toBe(9);
  });

  it("calcula a temporada atual de cada liga", () => {
    const nov = new Date(2026, 10, 21);
    expect(currentSeason("Premier League 2026/27", nov)).toBe(2026);
    expect(currentSeason("Premier League 2026/27", new Date(2027, 2, 1))).toBe(2026);
    expect(currentSeason("Brasileirão Série A 2026", new Date(2027, 2, 1))).toBe(2027);
  });
});

describe("chamadas à API-Football", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pede a chave quando ela não está configurada", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "");
    await expect(searchTeams("Arsenal")).rejects.toMatchObject({ problem: "chave" });
  });

  it("manda a chave no cabeçalho e lê os times", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    const fetcher = vi.fn(async () => ok([team(42, "Arsenal", "England")]));
    const found = await searchTeams("Arsenal", fetcher as unknown as typeof fetch);
    expect(found).toEqual([team(42, "Arsenal", "England")]);
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://v3.football.api-sports.io/teams?search=arsenal");
    expect((init.headers as Record<string, string>)["x-apisports-key"]).toBe("abc");
  });

  it("traduz os erros que vêm no corpo da resposta", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    const cases: [Record<string, string>, string][] = [
      [{ token: "Error/Missing application key." }, "chave"],
      [{ requests: "You have reached the request limit for the day" }, "dia"],
      [{ rateLimit: "Too many requests. Your rate limit is 10 requests per minute." }, "minuto"],
      [{ plan: "Free plans do not have access to this season, try from 2022 to 2024." }, "temporada"],
    ];
    for (const [errors, problem] of cases) {
      const fetcher = vi.fn(async () => reply({ errors, response: [] }));
      const err = await searchTeams("Arsenal", fetcher as unknown as typeof fetch).catch((e) => e);
      expect(err).toBeInstanceOf(ApiFootballError);
      expect(err.problem).toBe(problem);
    }
  });

  it("não busca com menos de 3 letras", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    await expect(searchTeams("PS")).rejects.toBeInstanceOf(ApiFootballError);
  });
});

describe("escudos no banco", () => {
  const dir = mkdtempSync(join(tmpdir(), "copinha-badges-"));
  const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db
      .insert(teams)
      .values([{ name: "Arsenal" }, { name: "Tottenham" }, { name: "Hull City" }, { name: "Íbis" }]);
  });
  afterAll(() => {
    db.$client.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows segura o arquivo por um instante; o temporário some depois.
    }
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const byName = async () =>
    Object.fromEntries((await db.select().from(teams)).map((t) => [t.name, t.badgeUrl]));

  it("só aceita link https e tira o escudo com texto vazio", async () => {
    const [ibis] = (await db.select().from(teams)).filter((t) => t.name === "Íbis");
    await expect(setTeamBadge(db, ibis.id, "javascript:alert(1)")).rejects.toBeInstanceOf(
      UserError,
    );
    await setTeamBadge(db, ibis.id, "https://exemplo.com/ibis.png");
    expect((await byName())["Íbis"]).toBe("https://exemplo.com/ibis.png");
    await setTeamBadge(db, ibis.id, "");
    expect((await byName())["Íbis"]).toBeNull();
  });

  it("preenche a liga com uma consulta e desce a temporada se o plano pedir", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    const seasons: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        const season = url.searchParams.get("season") ?? "";
        seasons.push(season);
        if (Number(season) > 2024)
          return reply({ errors: { plan: "Free plans do not have access to this season." } });
        return ok([
          team(42, "Arsenal", "England"),
          team(47, "Tottenham", "England"),
          team(99, "Arsenal", "Wales"),
        ]);
      }),
    );
    const res = await fillLeagueBadges(db, "Premier League 2026/27");
    expect(res.matched.sort()).toEqual(["Arsenal", "Tottenham"]);
    expect(res.missing).toEqual(["Hull City"]);
    expect(res.season).toBe(2024);
    expect(seasons.slice(-1)).toEqual(["2024"]);
    const now = await byName();
    expect(now.Arsenal).toBe(logo(42));
    expect(now.Tottenham).toBe(logo(47));

    // De novo: só o Hull falta, e a temporada já começa na que funcionou.
    seasons.length = 0;
    const again = await fillLeagueBadges(db, "Premier League 2026/27", 2024);
    expect(seasons).toEqual(["2024"]);
    expect(again.matched).toEqual([]);
  });

  it("não gasta consulta quando a liga já está completa ou não tem times", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const res = await fillLeagueBadges(db, "MLS 2026");
    expect(res.calls).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("ao juntar times, o escudo passa para o que fica", async () => {
    const all = await db.select().from(teams);
    const tot = all.find((t) => t.name === "Tottenham")!;
    const [spurs] = await db.insert(teams).values({ name: "Spurs" }).returning();
    await mergeTeams(db, tot.id, spurs.id);
    expect((await byName()).Spurs).toBe(logo(47));
  });
});

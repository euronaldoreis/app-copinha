import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb } from "@/db";
import { teamBadges, teams } from "@/db/schema";
import {
  ApiFootballError,
  bestMatch,
  currentSeason,
  downloadBadge,
  rankCandidates,
  searchTeams,
  searchTerm,
  similarity,
  suggestedTerm,
  type BadgeCandidate,
} from "@/lib/apiFootball";
import {
  UserError,
  deleteTeam,
  fillLeagueBadges,
  getTeamBadge,
  mergeTeams,
  setTeamBadge,
} from "@/lib/services";
import { badgePath } from "@/lib/teamBadge";

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
/** PNG mínimo (cabeçalho) — o conteúdo não importa para os testes. */
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const image = (type = "image/png", body: Buffer = PNG) =>
  new Response(new Uint8Array(body), { status: 200, headers: { "content-type": type } });
/** fetch falso: imagens respondem PNG; o resto vai para `api`. */
const fakeFetch = (api: (url: URL) => Response) =>
  vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    return url.pathname.endsWith(".png") ? image() : api(url);
  });
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
    // Rangers fora do catálogo: sem país para desempatar
    const list = [team(1, "Rangers", "Scotland"), team(2, "Rangers", "Chile")];
    expect(bestMatch("Rangers", list)).toBeNull();
  });

  it("desempata pelo país da liga do catálogo", () => {
    const list = [
      team(1, "Nacional", "Uruguay"),
      team(2, "Nacional", "Paraguay"),
      team(3, "Everton", "England"),
      team(4, "Everton", "Chile"),
    ];
    expect(bestMatch("Nacional", list)?.id).toBe(1);
    expect(bestMatch("Nacional Asunción", list)?.id).toBe(2);
    expect(bestMatch("Everton de Viña del Mar", list)?.id).toBe(4);
    expect(bestMatch("Everton", list)?.id).toBe(3);
  });

  it("aceita os times canadenses na MLS", () => {
    expect(bestMatch("Toronto FC", [team(9, "Toronto FC", "Canada")])?.id).toBe(9);
  });

  it("calcula a temporada atual de cada liga", () => {
    const nov = new Date(2026, 10, 21);
    expect(currentSeason("Premier League 2026/27", nov)).toBe(2026);
    expect(currentSeason("Premier League 2026/27", new Date(2027, 2, 1))).toBe(2026);
    expect(currentSeason("Brasileirão Série A 2026", new Date(2027, 2, 1))).toBe(2027);
    expect(currentSeason("Liga MX 2026/27", new Date(2027, 2, 1))).toBe(2026);
    expect(currentSeason("Liga Chilena 2026", nov)).toBe(2026);
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

  it("baixa só imagens PNG/JPG/WebP/GIF pequenas", async () => {
    const f = (r: Response) => vi.fn(async () => r) as unknown as typeof fetch;
    const got = await downloadBadge("https://x.com/a.png", f(image()));
    expect(got.contentType).toBe("image/png");
    expect(Buffer.from(got.data, "base64").equals(PNG)).toBe(true);
    await expect(downloadBadge("https://x.com/a.svg", f(image("image/svg+xml")))).rejects.toThrow();
    await expect(downloadBadge("https://x.com/a", f(image("text/html")))).rejects.toThrow();
    await expect(
      downloadBadge("https://x.com/a.png", f(image("image/png", Buffer.alloc(400_000)))),
    ).rejects.toThrow(/grande/);
    await expect(downloadBadge("http://x.com/a.png", f(image()))).rejects.toThrow(/https/);
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

  it("guarda a imagem no banco, só aceita https e tira o escudo com texto vazio", async () => {
    vi.stubGlobal("fetch", fakeFetch(() => reply({}, 404)));
    const [ibis] = (await db.select().from(teams)).filter((t) => t.name === "Íbis");
    await expect(setTeamBadge(db, ibis.id, "javascript:alert(1)")).rejects.toBeInstanceOf(
      UserError,
    );
    await setTeamBadge(db, ibis.id, "https://exemplo.com/ibis.png");
    expect((await byName())["Íbis"]).toBe("https://exemplo.com/ibis.png");
    expect((await getTeamBadge(db, ibis.id))?.contentType).toBe("image/png");
    // Link que não é imagem: não troca nada.
    await expect(setTeamBadge(db, ibis.id, "https://exemplo.com/pagina")).rejects.toBeInstanceOf(
      UserError,
    );
    expect((await byName())["Íbis"]).toBe("https://exemplo.com/ibis.png");
    await setTeamBadge(db, ibis.id, "");
    expect((await byName())["Íbis"]).toBeNull();
    expect(await getTeamBadge(db, ibis.id)).toBeNull();
    expect(await db.select().from(teamBadges)).toHaveLength(0);
  });

  it("baixa na primeira vez o escudo que só tinha o link", async () => {
    const [ibis] = (await db.select().from(teams)).filter((t) => t.name === "Íbis");
    await db.update(teams).set({ badgeUrl: "https://exemplo.com/velho.png" }).where(
      eq(teams.id, ibis.id),
    );
    const fetcher = fakeFetch(() => reply({}, 404));
    vi.stubGlobal("fetch", fetcher);
    expect(await getTeamBadge(db, ibis.id)).not.toBeNull();
    expect(await getTeamBadge(db, ibis.id)).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1); // a segunda já vem do banco
    await setTeamBadge(db, ibis.id, "");
  });

  it("o caminho do escudo muda quando o link muda", () => {
    expect(badgePath(3, "https://a/1.png")).toMatch(/^\/escudo\/3\?v=/);
    expect(badgePath(3, "https://a/1.png")).toBe(badgePath(3, "https://a/1.png"));
    expect(badgePath(3, "https://a/1.png")).not.toBe(badgePath(3, "https://a/2.png"));
  });

  it("preenche a liga com uma consulta e desce a temporada se o plano pedir", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", "abc");
    const seasons: string[] = [];
    vi.stubGlobal(
      "fetch",
      fakeFetch((url: URL) => {
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
    expect(await db.select().from(teamBadges)).toHaveLength(2);

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
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await getTeamBadge(db, spurs.id)).not.toBeNull();
    expect(fetcher).not.toHaveBeenCalled(); // a imagem foi junto
  });

  it("apagar o time apaga a imagem", async () => {
    const spurs = (await db.select().from(teams)).find((t) => t.name === "Spurs")!;
    await deleteTeam(db, spurs.id);
    const left = await db.select().from(teamBadges);
    expect(left.some((b) => b.teamId === spurs.id)).toBe(false);
  });
});

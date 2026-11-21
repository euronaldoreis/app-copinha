// Busca de escudos na API-Football (https://www.api-football.com). O plano
// gratuito pede cadastro e libera 100 consultas por dia, 10 por minuto. A chave
// fica em API_FOOTBALL_KEY e só é usada no servidor.
import catalog from "../../scripts/times.json";

// API_FOOTBALL_URL e API_FOOTBALL_MEDIA_URL só existem para testes locais com
// uma API simulada.
const base = () => process.env.API_FOOTBALL_URL || "https://v3.football.api-sports.io";

export interface BadgeCandidate {
  id: number;
  name: string;
  country: string;
  logo: string;
}

/** Ligas do catálogo (scripts/times.json) e como achá-las na API. */
export const LEAGUES: Record<string, { id: number; country: string; calendarYear?: boolean }> = {
  "Brasileirão Série A 2026": { id: 71, country: "Brazil", calendarYear: true },
  "Brasileirão Série B 2026": { id: 72, country: "Brazil", calendarYear: true },
  "Brasileirão Série C 2026": { id: 75, country: "Brazil", calendarYear: true },
  "Premier League 2026/27": { id: 39, country: "England" },
  "Serie A (Itália) 2026/27": { id: 135, country: "Italy" },
  "La Liga 2026/27": { id: 140, country: "Spain" },
  "Liga Portugal 2026/27": { id: 94, country: "Portugal" },
  "Ligue 1 2026/27": { id: 61, country: "France" },
  "Bundesliga 2026/27": { id: 78, country: "Germany" },
  "Eredivisie 2026/27": { id: 88, country: "Netherlands" },
  "Campeonato Argentino 2026": { id: 128, country: "Argentina", calendarYear: true },
  "MLS 2026": { id: 253, country: "USA", calendarYear: true },
};

const CATALOG = catalog as Record<string, string[]>;

/**
 * Nomes com que a API conhece os times cujo nome aqui é em português ou
 * diferente. Ajudam a busca e a comparação; não precisam ser exatos.
 */
const ALIASES: Record<string, string[]> = {
  "bayern de munique": ["Bayern Munchen", "Bayern Munich"],
  "inter de milao": ["Inter", "Inter Milan"],
  milan: ["AC Milan"],
  colonia: ["Koln", "1. FC Koln"],
  hamburgo: ["Hamburger SV"],
  "borussia monchengladbach": ["Monchengladbach"],
  "atletico de madrid": ["Atletico Madrid"],
  "athletic bilbao": ["Athletic Club"],
  "celta de vigo": ["Celta Vigo"],
  "deportivo la coruna": ["Deportivo La Coruna", "Deportivo"],
  "racing santander": ["Racing Santander"],
  "olympique de marseille": ["Marseille"],
  "paris saint-germain": ["Paris Saint Germain", "PSG"],
  "nacional da madeira": ["Nacional"],
  sporting: ["Sporting CP"],
  "vitoria de guimaraes": ["Guimaraes", "Vitoria Guimaraes"],
  estoril: ["Estoril"],
  "estrela da amadora": ["Estrela"],
  "academico de viseu": ["Academico Viseu"],
  "az alkmaar": ["AZ Alkmaar"],
  "nec nijmegen": ["NEC Nijmegen"],
  psv: ["PSV Eindhoven"],
  tottenham: ["Tottenham"],
  "atletico mineiro": ["Atletico-MG", "Atletico Mineiro"],
  "athletico paranaense": ["Atletico Paranaense", "Athletico-PR"],
  "red bull bragantino": ["Bragantino", "RB Bragantino"],
  vasco: ["Vasco DA Gama"],
  "america mineiro": ["America Mineiro"],
  "atletico goianiense": ["Atletico Goianiense"],
  "operario-pr": ["Operario-PR", "Operario"],
  "botafogo-sp": ["Botafogo SP"],
  "botafogo-pb": ["Botafogo PB"],
  "athletic club": ["Athletic Club"],
  "barra-sc": ["Barra"],
  "ypiranga-rs": ["Ypiranga"],
  "inter de limeira": ["Inter De Limeira", "Internacional Limeira"],
  "racing club": ["Racing Club"],
  "estudiantes de rio cuarto": ["Estudiantes Rio Cuarto"],
  estudiantes: ["Estudiantes L.P.", "Estudiantes de La Plata"],
  "gimnasia la plata": ["Gimnasia L.P."],
  "gimnasia de mendoza": ["Gimnasia Mendoza"],
  "union de santa fe": ["Union Santa Fe"],
  "central cordoba": ["Central Cordoba de Santiago"],
  talleres: ["Talleres Cordoba"],
  sarmiento: ["Sarmiento Junin"],
  "cf montreal": ["CF Montreal"],
  "d.c. united": ["DC United"],
  "st. louis city": ["St. Louis City"],
  "seattle sounders": ["Seattle Sounders"],
  "los angeles fc": ["Los Angeles FC"],
  "inter miami": ["Inter Miami"],
};

/** Sem acento e em minúsculas: "São Paulo" -> "sao paulo". */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** A busca da API só aceita letras, números e espaços. */
export function searchTerm(name: string) {
  return fold(name)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE = new Set([
  "fc", "cf", "sc", "ec", "ac", "afc", "cd", "ca", "club", "clube", "de", "da",
  "do", "dos", "das", "del", "la", "the", "sv", "vfb", "vfl", "tsg", "1",
  "rc", "ud", "sd", "rcd", "ss", "us", "ssc", "acf", "as", "ogc", "losc",
  "esporte", "futebol", "fk", "sk", "if",
]);

function tokens(name: string) {
  return searchTerm(name.replace(/-/g, " "))
    .split(" ")
    .filter((w) => w && !NOISE.has(w));
}

/** Parecença entre dois nomes, de 0 a 1 (palavras em comum). */
export function similarity(a: string, b: string) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  const sb = new Set(tb);
  const common = ta.filter((w) => sb.has(w)).length;
  return common / Math.max(ta.length, tb.length);
}

/** Nome do time e os apelidos que a API costuma usar. */
export function namesFor(team: string) {
  return [team, ...(ALIASES[fold(team)] ?? [])];
}

/** Liga do catálogo em que o time está, se estiver. */
export function catalogLeague(team: string) {
  const key = fold(team);
  return Object.keys(CATALOG).find((l) => CATALOG[l].some((t) => fold(t) === key));
}

// Na MLS jogam times dos EUA e do Canadá.
const COUNTRIES: Record<string, string[]> = { USA: ["USA", "Canada"] };

/** Países aceitos para uma liga, no formato da API ("Brazil"). */
export const leagueCountries = (league: string) => {
  const c = LEAGUES[league]?.country;
  return c ? (COUNTRIES[c] ?? [c]) : [];
};

/** Países possíveis do time segundo o catálogo. */
export function countryHint(team: string) {
  const league = catalogLeague(team);
  return league ? leagueCountries(league) : undefined;
}

/** Termo sugerido para a busca: o apelido em inglês ou o próprio nome. */
export function suggestedTerm(team: string) {
  return searchTerm(ALIASES[fold(team)]?.[0] ?? team);
}

// Times femininos, de base e reservas aparecem na busca e não interessam.
const NOT_FIRST_TEAM = /( w| women| fem(inino)?| u\d{2}| sub ?\d{2}| ii| b| reserves?)$/i;

/** Pontua os candidatos para o time e devolve do mais provável ao menos. */
export function rankCandidates(team: string, list: BadgeCandidate[]) {
  const names = namesFor(team);
  const country = countryHint(team);
  const wantsReserve = NOT_FIRST_TEAM.test(team);
  return list
    .filter((c) => c.logo && (wantsReserve || !NOT_FIRST_TEAM.test(c.name)))
    .map((c) => {
      let score = Math.max(...names.map((n) => similarity(n, c.name)));
      if (country) score += country.includes(c.country) ? 0.3 : -0.4;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ c, score }) => ({ ...c, score }));
}

/** O candidato que dá para escolher sem perguntar: parecido e sem empate. */
export function bestMatch(team: string, list: BadgeCandidate[]) {
  const [first, second] = rankCandidates(team, list);
  if (!first || first.score < 0.75) return null;
  if (second && first.score - second.score < 0.15) return null;
  return first;
}

// ---------------------------------------------------------------------------
// Chamadas à API

export type ApiFootballProblem = "chave" | "dia" | "minuto" | "temporada" | "outro";

export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly problem: ApiFootballProblem,
  ) {
    super(message);
  }
}

export const apiFootballKey = () => process.env.API_FOOTBALL_KEY?.trim() || "";

interface TeamsResponse {
  errors?: Record<string, string> | unknown[];
  response?: {
    team?: { id?: number; name?: string; country?: string; logo?: string; national?: boolean };
  }[];
}

/** Traduz os erros da API (que vêm com status 200, no campo "errors"). */
function problemOf(errors: Record<string, string>): ApiFootballError {
  const keys = Object.keys(errors).map((k) => k.toLowerCase());
  const text = Object.values(errors).join(" ");
  if (keys.includes("token") || /key|token/i.test(text))
    return new ApiFootballError(
      "A chave da API-Football não foi aceita. Confira API_FOOTBALL_KEY.",
      "chave",
    );
  if (keys.includes("ratelimit") || /per minute/i.test(text))
    return new ApiFootballError(
      "Limite de buscas por minuto da API-Football atingido. Espere um minuto.",
      "minuto",
    );
  if (keys.includes("requests") || /request limit|for the day/i.test(text))
    return new ApiFootballError(
      "Acabaram as buscas de hoje na API-Football (100 por dia no plano grátis). Tente amanhã.",
      "dia",
    );
  if (keys.includes("plan") || /season/i.test(text))
    return new ApiFootballError(`API-Football: ${text}`, "temporada");
  return new ApiFootballError(`API-Football: ${text || "erro desconhecido"}`, "outro");
}

async function getTeams(
  params: Record<string, string | number>,
  fetcher: typeof fetch = fetch,
): Promise<BadgeCandidate[]> {
  const key = apiFootballKey();
  if (!key)
    throw new ApiFootballError(
      "Falta configurar a chave da API-Football (API_FOOTBALL_KEY).",
      "chave",
    );
  const url = new URL(`${base()}/teams`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetcher(url, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiFootballError("Não foi possível falar com a API-Football agora.", "outro");
  }
  if (res.status === 429)
    throw new ApiFootballError(
      "Limite de buscas por minuto da API-Football atingido. Espere um minuto.",
      "minuto",
    );
  if (!res.ok)
    throw new ApiFootballError(`A API-Football respondeu com erro ${res.status}.`, "outro");
  const body = (await res.json()) as TeamsResponse;
  if (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors).length)
    throw problemOf(body.errors as Record<string, string>);
  return (body.response ?? [])
    .map((r) => r.team)
    .filter((t): t is NonNullable<typeof t> => !!t && !t.national && !!t.id && !!t.logo)
    .map((t) => ({
      id: t.id!,
      name: t.name ?? "",
      country: t.country ?? "",
      logo: t.logo!,
    }));
}

/** Busca por nome (1 consulta). */
export async function searchTeams(term: string, fetcher?: typeof fetch) {
  const q = searchTerm(term);
  if (q.length < 3)
    throw new ApiFootballError("Digite pelo menos 3 letras para buscar.", "outro");
  return getTeams({ search: q }, fetcher);
}

/**
 * Temporada atual da liga no formato da API: o ano em que ela começou (as
 * europeias começam em agosto; Brasil, Argentina e MLS seguem o ano).
 */
export function currentSeason(league: string, now = new Date()) {
  const year = now.getFullYear();
  return LEAGUES[league]?.calendarYear || now.getMonth() >= 6 ? year : year - 1;
}

/** Todos os times de uma liga numa temporada (1 consulta). */
export function leagueTeams(league: number, season: number, fetcher?: typeof fetch) {
  return getTeams({ league, season }, fetcher);
}

// ---------------------------------------------------------------------------
// Imagens

/** Tamanho máximo da imagem de um escudo (os da API têm uns 10 KB). */
export const BADGE_MAX_BYTES = 300_000;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Link da imagem de um time da API-Football pelo id dele na API. */
export const apiLogoUrl = (apiTeamId: number) =>
  `${process.env.API_FOOTBALL_MEDIA_URL || "https://media.api-sports.io"}/football/teams/${apiTeamId}.png`;

/**
 * Baixa a imagem de um escudo no servidor, para guardar no banco. Só aceita
 * PNG, JPEG, WebP e GIF (SVG pode carregar código) de até BADGE_MAX_BYTES.
 */
export async function downloadBadge(url: string, fetcher: typeof fetch = fetch) {
  if (!/^https:\/\//i.test(url))
    throw new ApiFootballError("O link do escudo precisa começar com https://", "outro");
  let res: Response;
  try {
    res = await fetcher(url, {
      headers: { "User-Agent": "Mozilla/5.0 (CopinhaDosLixos)", Accept: "image/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiFootballError("Não foi possível baixar a imagem do escudo agora.", "outro");
  }
  if (!res.ok)
    throw new ApiFootballError(
      `Não foi possível baixar a imagem do escudo (erro ${res.status}).`,
      res.status === 429 ? "minuto" : "outro",
    );
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(contentType))
    throw new ApiFootballError("O link não é de uma imagem PNG, JPG, WebP ou GIF.", "outro");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > BADGE_MAX_BYTES)
    throw new ApiFootballError("A imagem do escudo é grande demais (máximo 300 KB).", "outro");
  return { contentType, data: bytes.toString("base64") };
}

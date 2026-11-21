// Sigla de 3 letras e cor do escudo de cada time, para os cartões dos jogos.

/** Chave do mapa de escudos (nome -> link) que o layout passa para as telas. */
export const badgeKey = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

/** Siglas que não saem das 3 primeiras letras do nome (padrão FIFA). */
const CODES: Record<string, string> = {
  alemanha: "GER",
  holanda: "NED",
  "paises baixos": "NED",
  inglaterra: "ENG",
  japao: "JPN",
  "estados unidos": "USA",
  eua: "USA",
  "coreia do sul": "KOR",
  suica: "SUI",
  camaroes: "CMR",
  nigeria: "NGA",
  dinamarca: "DEN",
  suecia: "SWE",
  "pais de gales": "WAL",
  escocia: "SCO",
  irlanda: "IRL",
  grecia: "GRE",
  servia: "SRB",
  catar: "QAT",
  "arabia saudita": "KSA",
  ira: "IRN",
  "costa rica": "CRC",
  ucrania: "UKR",
  austria: "AUT",
  argelia: "ALG",
  "costa do marfim": "CIV",
  "africa do sul": "RSA",
  egito: "EGY",
  gana: "GHA",
  "republica tcheca": "CZE",
  tchequia: "CZE",
  eslovaquia: "SVK",
  eslovenia: "SVN",
  islandia: "ISL",
  "nova zelandia": "NZL",
  "real madrid": "RMA",
  barcelona: "BAR",
  "atletico de madrid": "ATM",
  "atletico madrid": "ATM",
  "atletico mineiro": "CAM",
  "atletico-mg": "CAM",
  "bayern de munique": "BAY",
  "bayern munique": "BAY",
  "paris saint-germain": "PSG",
  psg: "PSG",
  "manchester united": "MUN",
  "manchester city": "MCI",
  "sao paulo": "SAO",
  "inter de milao": "INT",
  "borussia dortmund": "BVB",
};

/** Cores dos escudos: fundo do escudo, conforme o uniforme mais conhecido. */
const COLORS: Record<string, string> = {
  brasil: "#1f9a3e",
  franca: "#2b56c9",
  argentina: "#4a9fe0",
  alemanha: "#2a2f3a",
  espanha: "#c8262e",
  portugal: "#9e1b2c",
  italia: "#1f5fc4",
  inglaterra: "#c8262e",
  holanda: "#ee7a14",
  "paises baixos": "#ee7a14",
  belgica: "#c8262e",
  croacia: "#d0283a",
  uruguai: "#5aa8e0",
  mexico: "#17804a",
  japao: "#1d3a8f",
  "estados unidos": "#1d3a8f",
  marrocos: "#b5202c",
  senegal: "#16884a",
  colombia: "#e0b51e",
  chile: "#c8262e",
  "real madrid": "#7c5fd6",
  barcelona: "#a3164a",
  "manchester united": "#c8262e",
  "manchester city": "#5aa8e0",
  liverpool: "#c8262e",
  chelsea: "#1f4fc4",
  juventus: "#2a2f3a",
  "bayern de munique": "#c8262e",
  flamengo: "#c8262e",
  palmeiras: "#17804a",
  corinthians: "#2a2f3a",
  "sao paulo": "#c8262e",
  santos: "#2a2f3a",
  gremio: "#3a8fd6",
  cruzeiro: "#1f4fc4",
  vasco: "#2a2f3a",
  fluminense: "#8c1d3a",
  botafogo: "#2a2f3a",
  internacional: "#c8262e",
};

const PALETTE = [
  "#2b56c9",
  "#c8262e",
  "#1f9a3e",
  "#ee7a14",
  "#7c5fd6",
  "#16889a",
  "#9e1b2c",
  "#2a2f3a",
];

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "fc", "ec", "sc"]);

function normalize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** "Brasil" -> "BRA", "Manchester United" -> "MUN", "Bayern de Munique" -> "BAY". */
export function teamCode(name: string) {
  const key = normalize(name);
  if (CODES[key]) return CODES[key];
  const words = key
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w));
  if (words.length === 0) return name.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  if (words.length === 2)
    return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Cor de fundo do escudo; sem cor conhecida, uma da paleta (sempre a mesma por nome). */
export function teamColor(name: string) {
  const key = normalize(name);
  if (COLORS[key]) return COLORS[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

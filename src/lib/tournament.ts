// Regras do torneio: tabela de jogos, classificação, chaveamento e colocações.
// Tudo aqui é função pura (sem banco), para poder ser testado e reutilizado
// tanto no servidor quanto nos formulários.

export type Format = "grupos" | "liga" | "mata" | "manual";
export type Stage = "grupo" | "mata" | "terceiro";
/**
 * Quem enfrenta quem na fase de grupos:
 * - interno: cada um joga contra os do próprio grupo;
 * - cruzado: cada um joga contra todos do grupo vizinho (A com B, C com D);
 * - misto: as duas coisas.
 * A classificação é sempre separada por grupo.
 */
export type Pairing = "interno" | "cruzado" | "misto";
export const PAIRINGS: Pairing[] = ["interno", "cruzado", "misto"];
export type ResultCode =
  | "campeao"
  | "vice"
  | "terceiro"
  | "quarto"
  | "semifinal"
  | "quartas"
  | "oitavas"
  | "eliminado"
  | "grupos"
  | "liga"
  | "participou";

export interface FormatConfig {
  format: Format;
  /** Número de grupos (só no formato "grupos"). */
  groupsCount: number;
  /** 1 = turno único, 2 = ida e volta (fase de grupos / pontos corridos). */
  legs: number;
  /** Confrontos da fase de grupos (só no formato "grupos"). */
  pairing: Pairing;
  /**
   * No misto: quantos adversários do outro grupo cada um enfrenta (0 = todos).
   * Com ida e volta, cada adversário é enfrentado duas vezes.
   */
  crossGames: number;
  /** Quantos avançam para o mata-mata (0 = campeão por pontos, só na liga). */
  qualifiers: number;
  thirdPlace: boolean;
}

export interface EntryLike {
  id: number;
  seed: number;
  groupLabel: string | null;
}

export interface MatchLike {
  id: number;
  stage: string;
  round: number;
  slot: number;
  groupLabel: string | null;
  homeEntryId: number | null;
  awayEntryId: number | null;
  homeSource: string | null;
  awaySource: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
}

export type PlannedMatch = Omit<
  MatchLike,
  "id" | "homeScore" | "awayScore" | "homePens" | "awayPens"
>;

export const GROUP_LABELS = "ABCDEFGHIJKLMNOP".split("");

export function isPowerOfTwo(n: number) {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

/** Normaliza a configuração para o formato escolhido. */
export function normalizeConfig(config: FormatConfig): FormatConfig {
  const legs = config.legs === 2 ? 2 : 1;
  const pairing = PAIRINGS.includes(config.pairing) ? config.pairing : "interno";
  const crossGames =
    pairing === "misto" && Number.isInteger(config.crossGames)
      ? Math.max(0, config.crossGames)
      : 0;
  switch (config.format) {
    case "grupos":
      return { ...config, legs, pairing, crossGames };
    case "liga":
      return {
        ...config,
        legs,
        groupsCount: 1,
        pairing: "interno",
        crossGames: 0,
      };
    case "mata":
      return {
        ...config,
        legs: 1,
        groupsCount: 0,
        qualifiers: 0,
        pairing: "interno",
        crossGames: 0,
      };
    default:
      return {
        format: "manual",
        legs: 1,
        groupsCount: 0,
        qualifiers: 0,
        thirdPlace: false,
        pairing: "interno",
        crossGames: 0,
      };
  }
}

/** Devolve uma mensagem de erro, ou null se a configuração serve para n participantes. */
export function validateConfig(raw: FormatConfig, n: number): string | null {
  const config = normalizeConfig(raw);
  if (config.format === "manual") return null;
  if (n < 2) return "É preciso pelo menos 2 participantes.";
  if (config.format === "mata") return null;

  const k = config.qualifiers;
  if (config.format === "liga") {
    if (k === 0) return null;
    if (!isPowerOfTwo(k) || k < 2)
      return "O número de classificados precisa ser 2, 4, 8 ou 16.";
    if (k > n)
      return `Não dá para classificar ${k} com apenas ${n} participantes.`;
    return null;
  }

  const g = config.groupsCount;
  if (!Number.isInteger(g) || g < 2 || g > GROUP_LABELS.length)
    return "Escolha pelo menos 2 grupos.";
  if (n < g * 2)
    return `Com ${g} grupos é preciso pelo menos ${g * 2} participantes.`;
  if (config.pairing !== "interno" && g % 2 === 1)
    return "Para um grupo enfrentar o outro é preciso um número par de grupos.";
  if (config.crossGames > 0) {
    // Limitar os jogos só fecha a conta se os dois grupos tiverem o mesmo
    // tamanho; senão alguém ficaria com um jogo a menos que os colegas de grupo.
    const sizes = groupSizes(n, g);
    for (let i = 0; i + 1 < g; i += 2) {
      const limited = config.crossGames < Math.max(sizes[i], sizes[i + 1]);
      if (limited && sizes[i] !== sizes[i + 1])
        return "Para definir a quantidade de jogos contra o outro grupo, os grupos precisam ter o mesmo tamanho.";
    }
  }
  if (!isPowerOfTwo(k) || k < 2)
    return "O número de classificados precisa ser 2, 4, 8 ou 16.";
  if (k < g)
    return "O número de classificados não pode ser menor que o número de grupos.";
  if (k > n)
    return `Não dá para classificar ${k} com apenas ${n} participantes.`;
  if (Math.floor(n / g) < Math.ceil(k / g))
    return "Os grupos ficam pequenos demais para essa quantidade de classificados.";
  return null;
}

/**
 * Confere grupos montados à mão. `sizes` traz quantos participantes há em cada
 * grupo, na ordem A, B, C... Devolve a mensagem de erro, ou null se serve.
 */
export function validateGroupSizes(
  raw: FormatConfig,
  sizes: number[],
): string | null {
  const config = normalizeConfig(raw);
  if (config.format !== "grupos") return "Esta edição não tem grupos.";
  const g = config.groupsCount;
  if (sizes.length !== g) return `A edição tem ${g} grupos.`;
  const n = sizes.reduce((sum, s) => sum + s, 0);
  const small = sizes.findIndex((s) => s < 2);
  if (small !== -1)
    return `O Grupo ${GROUP_LABELS[small]} precisa de pelo menos 2 participantes.`;
  if (config.pairing !== "interno" && g % 2 === 1)
    return "Para um grupo enfrentar o outro é preciso um número par de grupos.";
  if (config.crossGames > 0) {
    // Com jogos limitados contra o outro grupo, os dois grupos do par
    // precisam ter o mesmo tamanho, senão alguém jogaria menos que os colegas.
    for (let i = 0; i + 1 < g; i += 2) {
      const limited = config.crossGames < Math.max(sizes[i], sizes[i + 1]);
      if (limited && sizes[i] !== sizes[i + 1])
        return `Os grupos ${GROUP_LABELS[i]} e ${GROUP_LABELS[i + 1]} precisam ter o mesmo tamanho para limitar os jogos entre eles.`;
    }
  }
  const k = config.qualifiers;
  if (!isPowerOfTwo(k) || k < 2)
    return "O número de classificados precisa ser 2, 4, 8 ou 16.";
  if (k < g)
    return "O número de classificados não pode ser menor que o número de grupos.";
  if (k > n) return `Não dá para classificar ${k} com apenas ${n} participantes.`;
  // Cada grupo manda os `full` primeiros; as vagas que sobram vão para os
  // melhores da posição seguinte, que precisam existir em algum grupo.
  const full = Math.floor(k / g);
  const extra = k % g;
  if (Math.min(...sizes) < full)
    return "Algum grupo é pequeno demais para a quantidade de classificados.";
  if (sizes.filter((s) => s > full).length < extra)
    return "Os grupos são pequenos demais para a quantidade de classificados.";
  return null;
}

/** Tamanhos dos grupos para n participantes (os primeiros grupos recebem as sobras). */
export function groupSizes(n: number, groups: number): number[] {
  return Array.from(
    { length: groups },
    (_, i) => Math.floor(n / groups) + (i < n % groups ? 1 : 0),
  );
}

/** Distribui os participantes (já em ordem de sorteio) entre os grupos. */
export function assignGroups(entryIds: number[], groups: number) {
  return entryIds.map((id, i) => ({
    id,
    groupLabel: GROUP_LABELS[i % groups],
  }));
}

/** Todos contra todos pelo método do círculo. */
export function roundRobin(ids: number[], legs: number) {
  const list: (number | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const games: { round: number; home: number; away: number }[] = [];
  let arr = list;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a == null || b == null) continue;
      const flip = i === 0 ? r % 2 === 1 : i % 2 === 1;
      games.push({ round: r + 1, home: flip ? b : a, away: flip ? a : b });
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  if (legs === 2) {
    for (const g of [...games]) {
      games.push({ round: g.round + rounds, home: g.away, away: g.home });
    }
  }
  return games;
}

/**
 * Grupo contra grupo: cada participante de `a` enfrenta os de `b`, um jogo por
 * rodada. Se os grupos têm tamanhos diferentes, alguém folga na rodada.
 * `limit` corta o número de rodadas, ou seja, de adversários (0 = todos).
 */
export function crossGroup(a: number[], b: number[], legs: number, limit = 0) {
  const n = Math.max(a.length, b.length);
  const rounds = limit > 0 ? Math.min(limit, n) : n;
  const games: { round: number; home: number; away: number }[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) {
      const x = a[i];
      const y = b[(i + r) % n];
      if (x == null || y == null) continue;
      const flip = (i + r) % 2 === 1;
      games.push({ round: r + 1, home: flip ? y : x, away: flip ? x : y });
    }
  }
  if (legs === 2) {
    for (const g of [...games]) {
      games.push({ round: g.round + rounds, home: g.away, away: g.home });
    }
  }
  return games;
}

/** Ordem padrão de chaveamento: os cabeças 1 e 2 só se encontram na final. */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

interface SlotRef {
  entryId: number | null;
  source: string | null;
}

/**
 * Monta o mata-mata a partir da lista de cabeças de chave. Quando o número de
 * participantes não é potência de 2, os melhores cabeças folgam na 1ª fase.
 */
export function planKnockout(
  seeds: SlotRef[],
  thirdPlace: boolean,
): PlannedMatch[] {
  const n = seeds.length;
  if (n < 2) return [];
  let size = 1;
  while (size < n) size *= 2;
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  const out: PlannedMatch[] = [];

  const make = (round: number, slot: number, a: SlotRef, b: SlotRef) =>
    out.push({
      stage: "mata",
      round,
      slot,
      groupLabel: null,
      homeEntryId: a.entryId,
      awayEntryId: b.entryId,
      homeSource: a.source,
      awaySource: b.source,
    });

  let feed: SlotRef[] = [];
  const firstRoundSlots = new Set<number>();
  for (let i = 0; i < size / 2; i++) {
    const a = order[2 * i];
    const b = order[2 * i + 1];
    const sa = a <= n ? seeds[a - 1] : null;
    const sb = b <= n ? seeds[b - 1] : null;
    if (sa && sb) {
      make(1, i, sa, sb);
      firstRoundSlots.add(i);
      feed.push({ entryId: null, source: `W:1:${i}` });
    } else {
      feed.push((sa ?? sb)!);
    }
  }
  for (let r = 2; r <= rounds; r++) {
    const next: SlotRef[] = [];
    for (let i = 0; i < feed.length / 2; i++) {
      make(r, i, feed[2 * i], feed[2 * i + 1]);
      next.push({ entryId: null, source: `W:${r}:${i}` });
    }
    feed = next;
  }

  if (thirdPlace && rounds >= 2) {
    const semi = rounds - 1;
    const bothSemisExist =
      semi > 1 || (firstRoundSlots.has(0) && firstRoundSlots.has(1));
    if (bothSemisExist) {
      out.push({
        stage: "terceiro",
        round: rounds,
        slot: 0,
        groupLabel: null,
        homeEntryId: null,
        awayEntryId: null,
        homeSource: `L:${semi}:0`,
        awaySource: `L:${semi}:1`,
      });
    }
  }
  return out;
}

/** Cabeças de chave vindos da fase de grupos: 1ºs, depois 2ºs... e os melhores da posição seguinte. */
export function groupSeedSources(qualifiers: number, labels: string[]) {
  const g = labels.length;
  const full = Math.floor(qualifiers / g);
  const extra = qualifiers % g;
  const sources: string[] = [];
  for (let p = 1; p <= full; p++) {
    for (const label of labels) sources.push(`G:${label}:${p}`);
  }
  for (let w = 1; w <= extra; w++) sources.push(`B:${full + 1}:${w}`);
  return sources;
}

/**
 * Gera todos os jogos da edição. As entradas precisam chegar com `seed`
 * (ordem do sorteio) e, quando houver grupos, `groupLabel` definidos.
 */
export function planMatches(
  raw: FormatConfig,
  entries: EntryLike[],
): PlannedMatch[] {
  const config = normalizeConfig(raw);
  const sorted = [...entries].sort((a, b) => a.seed - b.seed);
  if (config.format === "manual") return [];

  if (config.format === "mata") {
    return planKnockout(
      sorted.map((e) => ({ entryId: e.id, source: null })),
      config.thirdPlace,
    );
  }

  const labels = [...new Set(sorted.map((e) => e.groupLabel ?? "A"))].sort();
  const idsOf = (label: string) =>
    sorted.filter((e) => (e.groupLabel ?? "A") === label).map((e) => e.id);
  const out: PlannedMatch[] = [];
  const slots = new Map<string, number>();
  // `label` é o grupo do jogo ou, em jogo entre grupos, o par (ex.: "AxB").
  const add = (label: string, round: number, home: number, away: number) => {
    const key = `${label}:${round}`;
    const slot = slots.get(key) ?? 0;
    slots.set(key, slot + 1);
    out.push({
      stage: "grupo",
      round,
      slot,
      groupLabel: label,
      homeEntryId: home,
      awayEntryId: away,
      homeSource: null,
      awaySource: null,
    });
  };

  if (config.pairing !== "cruzado") {
    for (const label of labels) {
      for (const g of roundRobin(idsOf(label), config.legs))
        add(label, g.round, g.home, g.away);
    }
  }
  if (config.pairing !== "interno") {
    // No misto, os jogos entre grupos vêm depois das rodadas internas.
    const offset = out.reduce((max, m) => Math.max(max, m.round), 0);
    for (let k = 0; k + 1 < labels.length; k += 2) {
      const [a, b] = [labels[k], labels[k + 1]];
      for (const g of crossGroup(idsOf(a), idsOf(b), config.legs, config.crossGames))
        add(`${a}x${b}`, g.round + offset, g.home, g.away);
    }
  }
  if (config.qualifiers >= 2) {
    out.push(
      ...planKnockout(
        groupSeedSources(config.qualifiers, labels).map((source) => ({
          entryId: null,
          source,
        })),
        config.thirdPlace,
      ),
    );
  }
  return out;
}

/** Quantidade de jogos que a configuração gera (para a prévia no formulário). */
/** Participantes fictícios, só para simular a tabela nas prévias. */
function sampleEntries(config: FormatConfig, n: number): EntryLike[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    seed: i,
    groupLabel:
      config.format === "grupos"
        ? GROUP_LABELS[i % config.groupsCount]
        : config.format === "liga"
          ? "A"
          : null,
  }));
}

export function countMatches(raw: FormatConfig, n: number) {
  const config = normalizeConfig(raw);
  if (validateConfig(config, n) || config.format === "manual")
    return { group: 0, knockout: 0 };
  const planned = planMatches(config, sampleEntries(config, n));
  const group = planned.filter((m) => m.stage === "grupo").length;
  return { group, knockout: planned.length - group };
}

/** Quantos jogos cada participante faz antes do mata-mata (menor e maior número). */
export function groupGamesPerEntry(raw: FormatConfig, n: number) {
  const config = normalizeConfig(raw);
  if (validateConfig(config, n)) return null;
  const count = new Map<number, number>();
  for (const m of planMatches(config, sampleEntries(config, n))) {
    if (m.stage !== "grupo") continue;
    for (const id of [m.homeEntryId, m.awayEntryId]) {
      if (id != null) count.set(id, (count.get(id) ?? 0) + 1);
    }
  }
  if (count.size === 0) return null;
  const values = [...count.values()];
  return { min: Math.min(...values), max: Math.max(...values) };
}

// ---------------------------------------------------------------------------
// Classificação

export interface StandingRow {
  entryId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function hasScore(m: MatchLike) {
  return m.homeScore != null && m.awayScore != null;
}

function tally(ids: number[], matches: MatchLike[]) {
  const rows = new Map<number, StandingRow>(
    ids.map((id) => [
      id,
      {
        entryId: id,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      },
    ]),
  );
  for (const m of matches) {
    if (!hasScore(m) || m.homeEntryId == null || m.awayEntryId == null)
      continue;
    // Cada lado é contado por conta própria: em jogo entre grupos o adversário
    // não está nesta tabela, mas o resultado vale do mesmo jeito.
    const sides = [
      { row: rows.get(m.homeEntryId), gf: m.homeScore!, ga: m.awayScore! },
      { row: rows.get(m.awayEntryId), gf: m.awayScore!, ga: m.homeScore! },
    ];
    for (const { row, gf, ga } of sides) {
      if (!row) continue;
      row.played++;
      row.gf += gf;
      row.ga += ga;
      if (gf > ga) {
        row.wins++;
        row.points += 3;
      } else if (gf < ga) {
        row.losses++;
      } else {
        row.draws++;
        row.points++;
      }
    }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  return rows;
}

const basicOrder = (a: StandingRow, b: StandingRow) =>
  b.points - a.points || b.wins - a.wins || b.gd - a.gd || b.gf - a.gf;

/**
 * Classificação de um grupo. Critérios: pontos, vitórias, saldo, gols pró,
 * confronto direto e, por último, a ordem do sorteio.
 */
export function computeStandings(
  entries: EntryLike[],
  matches: MatchLike[],
): StandingRow[] {
  const ids = entries.map((e) => e.id);
  const seedOf = new Map(entries.map((e) => [e.id, e.seed]));
  const rows = [...tally(ids, matches).values()].sort(basicOrder);

  const out: StandingRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && basicOrder(rows[i], rows[j]) === 0) j++;
    const tied = rows.slice(i, j);
    if (tied.length > 1) {
      const tiedIds = tied.map((r) => r.entryId);
      const mini = tally(
        tiedIds,
        matches.filter(
          (m) =>
            m.homeEntryId != null &&
            m.awayEntryId != null &&
            tiedIds.includes(m.homeEntryId) &&
            tiedIds.includes(m.awayEntryId),
        ),
      );
      tied.sort((a, b) => {
        const ma = mini.get(a.entryId)!;
        const mb = mini.get(b.entryId)!;
        return (
          mb.points - ma.points ||
          mb.gd - ma.gd ||
          mb.gf - ma.gf ||
          (seedOf.get(a.entryId) ?? 0) - (seedOf.get(b.entryId) ?? 0)
        );
      });
    }
    out.push(...tied);
    i = j;
  }
  return out;
}

export function groupLabelsOf(entries: EntryLike[]) {
  return [
    ...new Set(entries.map((e) => e.groupLabel).filter((l) => l != null)),
  ].sort() as string[];
}

export function standingsByGroup(entries: EntryLike[], matches: MatchLike[]) {
  const groupMatches = matches.filter((m) => m.stage === "grupo");
  return groupLabelsOf(entries).map((label) => ({
    label,
    rows: computeStandings(
      entries.filter((e) => e.groupLabel === label),
      groupMatches,
    ),
  }));
}

export function groupStageComplete(matches: MatchLike[]) {
  return matches.filter((m) => m.stage === "grupo").every(hasScore);
}

/** Quem ocupa cada vaga vinda dos grupos (G:A:1, B:3:1...). Null se a fase não acabou. */
export function resolveGroupSeeds(
  entries: EntryLike[],
  matches: MatchLike[],
): Map<string, number> | null {
  const groupMatches = matches.filter((m) => m.stage === "grupo");
  if (groupMatches.length === 0 || !groupMatches.every(hasScore)) return null;

  const tables = standingsByGroup(entries, matches);
  const map = new Map<string, number>();
  const maxSize = Math.max(...tables.map((t) => t.rows.length));
  for (const t of tables) {
    t.rows.forEach((row, i) => map.set(`G:${t.label}:${i + 1}`, row.entryId));
  }
  // Melhores colocados de cada posição, comparando por jogo disputado, já que
  // os grupos podem ter tamanhos diferentes.
  for (let pos = 1; pos <= maxSize; pos++) {
    const candidates = tables
      .filter((t) => t.rows[pos - 1])
      .map((t) => ({ label: t.label, row: t.rows[pos - 1] }));
    const per = (v: number, r: StandingRow) => (r.played ? v / r.played : 0);
    candidates.sort(
      (a, b) =>
        per(b.row.points, b.row) - per(a.row.points, a.row) ||
        per(b.row.gd, b.row) - per(a.row.gd, a.row) ||
        per(b.row.gf, b.row) - per(a.row.gf, a.row) ||
        a.label.localeCompare(b.label),
    );
    candidates.forEach((c, i) => map.set(`B:${pos}:${i + 1}`, c.row.entryId));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Mata-mata

/** Um jogo de mata-mata está decidido quando há placar e, em caso de empate, pênaltis. */
export function matchWinner(m: MatchLike): number | null {
  if (!hasScore(m) || m.homeEntryId == null || m.awayEntryId == null)
    return null;
  if (m.homeScore! > m.awayScore!) return m.homeEntryId;
  if (m.homeScore! < m.awayScore!) return m.awayEntryId;
  if (m.homePens == null || m.awayPens == null || m.homePens === m.awayPens)
    return null;
  return m.homePens > m.awayPens ? m.homeEntryId : m.awayEntryId;
}

export function matchLoser(m: MatchLike): number | null {
  const winner = matchWinner(m);
  if (winner == null) return null;
  return winner === m.homeEntryId ? m.awayEntryId : m.homeEntryId;
}

export interface KnockoutChange {
  id: number;
  homeEntryId: number | null;
  awayEntryId: number | null;
  /** O confronto mudou e o placar antigo deixou de valer. */
  clearScore: boolean;
}

/**
 * Preenche as vagas do mata-mata conforme os resultados. Devolve o que mudou e
 * a lista de jogos já atualizada.
 */
export function resolveKnockout(entries: EntryLike[], matches: MatchLike[]) {
  const work = matches.map((m) => ({ ...m }));
  const seeds = resolveGroupSeeds(entries, work);
  const knockout = work
    .filter((m) => m.stage !== "grupo")
    .sort(
      (a, b) =>
        a.round - b.round ||
        (a.stage === "mata" ? 0 : 1) - (b.stage === "mata" ? 0 : 1) ||
        a.slot - b.slot,
    );
  const find = (round: number, slot: number) =>
    work.find((m) => m.stage === "mata" && m.round === round && m.slot === slot);

  const resolve = (source: string): number | null => {
    const [kind, a, b] = source.split(":");
    if (kind === "G" || kind === "B") return seeds?.get(source) ?? null;
    const ref = find(Number(a), Number(b));
    if (!ref) return null;
    return kind === "W" ? matchWinner(ref) : matchLoser(ref);
  };

  const changes: KnockoutChange[] = [];
  for (const m of knockout) {
    const home = m.homeSource ? resolve(m.homeSource) : m.homeEntryId;
    const away = m.awaySource ? resolve(m.awaySource) : m.awayEntryId;
    if (home === m.homeEntryId && away === m.awayEntryId) continue;
    const clearScore = hasScore(m);
    m.homeEntryId = home;
    m.awayEntryId = away;
    if (clearScore) {
      m.homeScore = m.awayScore = m.homePens = m.awayPens = null;
    }
    changes.push({ id: m.id, homeEntryId: home, awayEntryId: away, clearScore });
  }
  return { changes, matches: work };
}

export function knockoutRounds(matches: { stage: string; round: number }[]) {
  return matches
    .filter((m) => m.stage === "mata")
    .reduce((max, m) => Math.max(max, m.round), 0);
}

/** Colocações finais. `finished` só é verdadeiro quando o campeão está definido. */
export function computeResults(
  raw: FormatConfig,
  entries: EntryLike[],
  matches: MatchLike[],
): { finished: boolean; results: Map<number, ResultCode> } {
  const config = normalizeConfig(raw);
  const results = new Map<number, ResultCode>();
  const pending = { finished: false, results };
  if (config.format === "manual" || matches.length === 0) return pending;

  const totalRounds = knockoutRounds(matches);
  if (totalRounds === 0) {
    // Pontos corridos sem final: vale a classificação.
    if (!groupStageComplete(matches)) return pending;
    const table = computeStandings(entries, matches);
    const podium: ResultCode[] = ["campeao", "vice", "terceiro"];
    table.forEach((row, i) => results.set(row.entryId, podium[i] ?? "liga"));
    return { finished: true, results };
  }

  const final = matches.find(
    (m) => m.stage === "mata" && m.round === totalRounds,
  );
  const third = matches.find((m) => m.stage === "terceiro");
  if (!final || matchWinner(final) == null) return pending;
  if (third && matchWinner(third) == null) return pending;

  const base: ResultCode =
    config.format === "liga"
      ? "liga"
      : config.format === "grupos"
        ? "grupos"
        : "eliminado";
  for (const e of entries) results.set(e.id, base);

  const byRoundSize: Record<number, ResultCode> = {
    4: "semifinal",
    8: "quartas",
    16: "oitavas",
  };
  for (const m of matches) {
    if (m.stage !== "mata" || m.round === totalRounds) continue;
    const loser = matchLoser(m);
    if (loser == null) continue;
    const size = 2 ** (totalRounds - m.round + 1);
    results.set(loser, byRoundSize[size] ?? "eliminado");
  }
  if (third) {
    results.set(matchWinner(third)!, "terceiro");
    results.set(matchLoser(third)!, "quarto");
  }
  results.set(matchWinner(final)!, "campeao");
  results.set(matchLoser(final)!, "vice");
  return { finished: true, results };
}

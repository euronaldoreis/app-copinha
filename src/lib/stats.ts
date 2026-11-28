// Estatísticas históricas, calculadas a partir de todas as edições.
import type { Edition, Entry, Match, Player, Team } from "@/db/schema";
import { resultRank, roundLabel } from "./labels";
import { knockoutRounds } from "./tournament";

export interface AllData {
  players: Player[];
  teams: Team[];
  editions: Edition[];
  entries: Entry[];
  matches: Match[];
}

export interface Record_ {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

export interface PlayerStats extends Record_ {
  player: Player;
  participations: number;
  titles: number;
  vices: number;
  finals: number;
  thirds: number;
  podiums: number;
  top4: number;
  gd: number;
  /** Aproveitamento em % dos pontos disputados, ou null sem jogos. */
  pct: number | null;
  /** Pontos ganhos em campo: vitória vale 3 e empate 1. */
  points: number;
  bestResult: string | null;
}

const emptyRecord = (): Record_ => ({
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  gf: 0,
  ga: 0,
});

function addGame(rec: Record_, gf: number, ga: number) {
  rec.played++;
  rec.gf += gf;
  rec.ga += ga;
  if (gf > ga) rec.wins++;
  else if (gf < ga) rec.losses++;
  else rec.draws++;
}

export function pct(rec: Record_) {
  if (rec.played === 0) return null;
  return Math.round(((rec.wins * 3 + rec.draws) / (rec.played * 3)) * 100);
}

const isPlayed = (m: Match) =>
  m.homeScore != null &&
  m.awayScore != null &&
  m.homeEntryId != null &&
  m.awayEntryId != null;

/** Edições que contam para o histórico (as que ainda estão em inscrições ficam de fora). */
function countedEditionIds(data: AllData) {
  return new Set(
    data.editions.filter((e) => e.status !== "inscricoes").map((e) => e.id),
  );
}

export function computeRanking(data: AllData): PlayerStats[] {
  const counted = countedEditionIds(data);
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const stats = new Map<number, PlayerStats>(
    data.players.map((player) => [
      player.id,
      {
        player,
        participations: 0,
        titles: 0,
        vices: 0,
        finals: 0,
        thirds: 0,
        podiums: 0,
        top4: 0,
        gd: 0,
        pct: null,
        points: 0,
        bestResult: null,
        ...emptyRecord(),
      },
    ]),
  );

  for (const entry of data.entries) {
    const s = stats.get(entry.playerId);
    if (!s || !counted.has(entry.editionId)) continue;
    s.participations++;
    const r = entry.result;
    if (!r) continue;
    if (r === "campeao") s.titles++;
    if (r === "vice") s.vices++;
    if (r === "terceiro") s.thirds++;
    if (r === "campeao" || r === "vice") s.finals++;
    if (r === "campeao" || r === "vice" || r === "terceiro") s.podiums++;
    if (["campeao", "vice", "terceiro", "quarto", "semifinal"].includes(r))
      s.top4++;
    if (s.bestResult == null || resultRank(r) < resultRank(s.bestResult))
      s.bestResult = r;
  }

  for (const m of data.matches) {
    if (!isPlayed(m)) continue;
    const home = stats.get(entryById.get(m.homeEntryId!)?.playerId ?? -1);
    const away = stats.get(entryById.get(m.awayEntryId!)?.playerId ?? -1);
    if (home) addGame(home, m.homeScore!, m.awayScore!);
    if (away) addGame(away, m.awayScore!, m.homeScore!);
  }

  for (const s of stats.values()) {
    s.gd = s.gf - s.ga;
    s.pct = pct(s);
    s.points = s.wins * 3 + s.draws;
  }

  return [...stats.values()].sort(
    (a, b) =>
      b.titles - a.titles ||
      b.finals - a.finals ||
      b.podiums - a.podiums ||
      b.top4 - a.top4 ||
      b.participations - a.participations ||
      (b.pct ?? -1) - (a.pct ?? -1) ||
      a.player.name.localeCompare(b.player.name, "pt-BR"),
  );
}

/**
 * Ordem do ranking de jogos: mais pontos primeiro. Quem jogou mais tem mais
 * chance de somar pontos, então um aproveitamento de 100% em 1 jogo não passa
 * quem ganhou 7 de 10. Empate em pontos: melhor aproveitamento, depois saldo
 * de gols, gols marcados, mais jogos e nome.
 */
export function sortByGames<
  T extends Pick<PlayerStats, "points" | "pct" | "gd" | "gf" | "played"> & {
    player: { name: string };
  },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      (b.pct ?? 0) - (a.pct ?? 0) ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      b.played - a.played ||
      a.player.name.localeCompare(b.player.name, "pt-BR"),
  );
}

export interface HeadToHead extends Record_ {
  opponent: Player;
}

/** Retrospecto de um jogador contra cada adversário que já enfrentou. */
export function computeHeadToHead(data: AllData, playerId: number) {
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const map = new Map<number, HeadToHead>();

  for (const m of data.matches) {
    if (!isPlayed(m)) continue;
    const home = entryById.get(m.homeEntryId!)?.playerId;
    const away = entryById.get(m.awayEntryId!)?.playerId;
    if (home == null || away == null) continue;
    if (home !== playerId && away !== playerId) continue;
    const mine = home === playerId;
    const opponent = playerById.get(mine ? away : home);
    if (!opponent) continue;
    let rec = map.get(opponent.id);
    if (!rec) {
      rec = { opponent, ...emptyRecord() };
      map.set(opponent.id, rec);
    }
    addGame(
      rec,
      mine ? m.homeScore! : m.awayScore!,
      mine ? m.awayScore! : m.homeScore!,
    );
  }
  return [...map.values()].sort(
    (a, b) =>
      b.played - a.played ||
      a.opponent.name.localeCompare(b.opponent.name, "pt-BR"),
  );
}

/** Um jogo do confronto direto, sempre visto do lado de A. */
export interface RivalryGame {
  matchId: number;
  edition: Edition;
  /** Fase do jogo: "Grupo A", "Rodada 2", "Semifinal", "Final"... */
  label: string;
  knockout: boolean;
  final: boolean;
  aScore: number;
  bScore: number;
  aPens: number | null;
  bPens: number | null;
  aTeam: string | null;
  bTeam: string | null;
  /** Quem levou o jogo (no mata-mata, os pênaltis decidem o empate). */
  winner: "a" | "b" | null;
}

export interface Rivalry {
  /** Vitórias, empates e gols do ponto de vista de A. */
  record: Record_;
  /** Do mais recente para o mais antigo. */
  games: RivalryGame[];
  /** Maior vitória de cada lado (maior saldo; empate de saldo, mais gols). */
  biggest: { a: RivalryGame | null; b: RivalryGame | null };
  /** Quantas vezes cada um despachou o outro no mata-mata (final inclusa). */
  knockouts: { a: number; b: number };
  finals: { a: number; b: number };
  /** Sequência atual: quem vem ganhando (ou empatando) e há quantos jogos. */
  streak: { who: "a" | "b" | "empate"; count: number } | null;
}

/** Ordem dos jogos dentro de uma edição: grupos, repescagem, mata-mata. */
function matchOrder(m: Match, totalRounds: number) {
  if (m.stage === "grupo") return m.round;
  if (m.stage === "repescagem") return 1000;
  // o 3º lugar é jogado antes da final
  if (m.stage === "terceiro") return 2000 + totalRounds * 10 - 5;
  return 2000 + m.round * 10;
}

function stageName(m: Match, edition: Edition, totalRounds: number) {
  if (m.stage === "repescagem") return "Repescagem";
  if (m.stage === "terceiro") return "Disputa de 3º lugar";
  if (m.stage === "mata") return roundLabel(m.round, totalRounds);
  return edition.format === "grupos" && m.groupLabel
    ? `Grupo ${m.groupLabel}`
    : `Rodada ${m.round}`;
}

/** Tudo o que aconteceu entre dois jogadores, jogo a jogo. */
export function computeRivalry(data: AllData, aId: number, bId: number): Rivalry {
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const teamById = new Map(data.teams.map((t) => [t.id, t.name]));
  const editionById = new Map(data.editions.map((e) => [e.id, e]));
  const roundsOf = new Map<number, number>();
  for (const ed of data.editions)
    roundsOf.set(
      ed.id,
      knockoutRounds(data.matches.filter((m) => m.editionId === ed.id)),
    );

  const record = emptyRecord();
  const ordered: { game: RivalryGame; key: [number, number, number] }[] = [];
  for (const m of data.matches) {
    if (!isPlayed(m)) continue;
    const home = entryById.get(m.homeEntryId!);
    const away = entryById.get(m.awayEntryId!);
    const edition = editionById.get(m.editionId);
    if (!home || !away || !edition) continue;
    const aHome = home.playerId === aId && away.playerId === bId;
    const aAway = home.playerId === bId && away.playerId === aId;
    if (!aHome && !aAway) continue;
    const [aEntry, bEntry] = aHome ? [home, away] : [away, home];
    const aScore = aHome ? m.homeScore! : m.awayScore!;
    const bScore = aHome ? m.awayScore! : m.homeScore!;
    const aPens = aHome ? m.homePens : m.awayPens;
    const bPens = aHome ? m.awayPens : m.homePens;
    const knockout = m.stage !== "grupo";
    const totalRounds = roundsOf.get(edition.id) ?? 0;
    const diff = aScore - bScore || (knockout ? (aPens ?? 0) - (bPens ?? 0) : 0);
    addGame(record, aScore, bScore);
    ordered.push({
      key: [edition.number, matchOrder(m, totalRounds), m.id],
      game: {
        matchId: m.id,
        edition,
        label: stageName(m, edition, totalRounds),
        knockout,
        final: m.stage === "mata" && m.round === totalRounds,
        aScore,
        bScore,
        aPens,
        bPens,
        aTeam: aEntry.teamId != null ? (teamById.get(aEntry.teamId) ?? null) : null,
        bTeam: bEntry.teamId != null ? (teamById.get(bEntry.teamId) ?? null) : null,
        winner: diff > 0 ? "a" : diff < 0 ? "b" : null,
      },
    });
  }
  // mais recente primeiro
  ordered.sort(
    (x, y) =>
      y.key[0] - x.key[0] || y.key[1] - x.key[1] || y.key[2] - x.key[2],
  );
  const games = ordered.map((o) => o.game);

  const biggestOf = (side: "a" | "b") => {
    let best: RivalryGame | null = null;
    const margin = (g: RivalryGame) =>
      side === "a" ? g.aScore - g.bScore : g.bScore - g.aScore;
    const goals = (g: RivalryGame) => (side === "a" ? g.aScore : g.bScore);
    for (const g of games) {
      if (margin(g) <= 0) continue;
      if (
        !best ||
        margin(g) > margin(best) ||
        (margin(g) === margin(best) && goals(g) > goals(best))
      )
        best = g;
    }
    return best;
  };

  const knockouts = { a: 0, b: 0 };
  const finals = { a: 0, b: 0 };
  for (const g of games) {
    // a disputa de 3º lugar não elimina ninguém
    if (!g.winner || !g.knockout || g.label === "Disputa de 3º lugar") continue;
    knockouts[g.winner]++;
    if (g.final) finals[g.winner]++;
  }

  let streak: Rivalry["streak"] = null;
  for (const g of games) {
    const who = g.winner ?? "empate";
    if (!streak) streak = { who, count: 1 };
    else if (streak.who === who) streak.count++;
    else break;
  }

  return {
    record,
    games,
    biggest: { a: biggestOf("a"), b: biggestOf("b") },
    knockouts,
    finals,
    streak,
  };
}

export interface TeamStats {
  team: Team;
  uses: number;
  titles: number;
  finals: number;
  /** Quem já foi campeão com o time. */
  champions: string[];
}

export function computeTeamRanking(data: AllData): TeamStats[] {
  const counted = countedEditionIds(data);
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const map = new Map<number, TeamStats>(
    data.teams.map((team) => [
      team.id,
      { team, uses: 0, titles: 0, finals: 0, champions: [] },
    ]),
  );
  for (const entry of data.entries) {
    if (entry.teamId == null || !counted.has(entry.editionId)) continue;
    const s = map.get(entry.teamId);
    if (!s) continue;
    s.uses++;
    if (entry.result === "campeao") {
      s.titles++;
      const name = playerById.get(entry.playerId)?.name;
      if (name && !s.champions.includes(name)) s.champions.push(name);
    }
    if (entry.result === "campeao" || entry.result === "vice") s.finals++;
  }
  return [...map.values()]
    .filter((s) => s.uses > 0)
    .sort(
      (a, b) =>
        b.titles - a.titles ||
        b.finals - a.finals ||
        b.uses - a.uses ||
        a.team.name.localeCompare(b.team.name, "pt-BR"),
    );
}

export interface MatchRecord {
  edition: Edition;
  home: Player;
  away: Player;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
}

export interface Records {
  biggestWin: MatchRecord | null;
  mostGoals: MatchRecord | null;
  bestAttack: { player: Player; edition: Edition; goals: number } | null;
  /** Confronto mais desequilibrado entre dois jogadores (mínimo de 3 jogos). */
  rivalry: {
    winner: Player;
    loser: Player;
    wins: number;
    losses: number;
    draws: number;
  } | null;
  /** Mais jogos seguidos sem perder (empate conta; vale o placar do jogo). */
  unbeatenRun: {
    player: Player;
    games: number;
    from: Edition;
    to: Edition;
  } | null;
  /** Campeões que não perderam nenhum jogo na edição, do mais recente ao mais antigo. */
  unbeatenChampions: {
    player: Player;
    edition: Edition;
    wins: number;
    draws: number;
  }[];
  /** Pior campanha numa edição (mínimo de 2 jogos). */
  worstCampaign: {
    player: Player;
    edition: Edition;
    played: number;
    points: number;
    gf: number;
    ga: number;
  } | null;
  /** Quem mais venceu disputas de pênaltis. */
  penaltyKing: { player: Player; won: number; total: number } | null;

  /** Final mais desequilibrada. */
  finalRout: MatchRecord | null;
  /** Final com mais gols. */
  finalGoals: MatchRecord | null;
  /** Disputa de pênaltis com mais cobranças convertidas. */
  longestShootout:
    (MatchRecord & { homePens: number; awayPens: number }) | null;
  /** Menos gols sofridos por jogo numa edição (mínimo de 3 jogos). */
  bestDefense: {
    player: Player;
    edition: Edition;
    played: number;
    ga: number;
  } | null;
  /** Maior saldo de gols numa edição. */
  bestGoalDiff: {
    player: Player;
    edition: Edition;
    played: number;
    gd: number;
  } | null;
  /** Mais vitórias seguidas (mínimo de 2). */
  winStreak: Streak | null;
  /** Mais jogos seguidos sem vencer (mínimo de 2). */
  drought: Streak | null;
  /** Títulos em edições seguidas (mínimo de 2). */
  titleStreak: Streak | null;
  /** Finais em edições seguidas (mínimo de 2). */
  finalsStreak: Streak | null;
  /** Dupla que mais se enfrentou (mínimo de 2 jogos). */
  classic: {
    a: Player;
    b: Player;
    aWins: number;
    bWins: number;
    draws: number;
  } | null;
  /** Edição com a maior média de gols por jogo (mínimo de 3 jogos). */
  goalFest: { edition: Edition; games: number; goals: number } | null;
}

/** Sequência de um jogador, de uma edição a outra. */
export interface Streak {
  player: Player;
  count: number;
  from: Edition;
  to: Edition;
}

export function computeRecords(data: AllData): Records {
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  const editionById = new Map(data.editions.map((e) => [e.id, e]));

  let biggestWin: Match | null = null;
  let mostGoals: Match | null = null;
  const goalsByEntry = new Map<number, number>();
  const diff = (m: Match) => Math.abs(m.homeScore! - m.awayScore!);
  const total = (m: Match) => m.homeScore! + m.awayScore!;

  for (const m of data.matches) {
    if (!isPlayed(m)) continue;
    if (
      diff(m) > 0 &&
      (!biggestWin ||
        diff(m) > diff(biggestWin) ||
        (diff(m) === diff(biggestWin) && total(m) > total(biggestWin)))
    )
      biggestWin = m;
    if (total(m) > 0 && (!mostGoals || total(m) > total(mostGoals)))
      mostGoals = m;
    goalsByEntry.set(
      m.homeEntryId!,
      (goalsByEntry.get(m.homeEntryId!) ?? 0) + m.homeScore!,
    );
    goalsByEntry.set(
      m.awayEntryId!,
      (goalsByEntry.get(m.awayEntryId!) ?? 0) + m.awayScore!,
    );
  }

  const describe = (m: Match | null): MatchRecord | null => {
    if (!m) return null;
    const home = entryById.get(m.homeEntryId!);
    const away = entryById.get(m.awayEntryId!);
    const edition = editionById.get(m.editionId);
    const homePlayer = home && playerById.get(home.playerId);
    const awayPlayer = away && playerById.get(away.playerId);
    if (!home || !away || !edition || !homePlayer || !awayPlayer) return null;
    return {
      edition,
      home: homePlayer,
      away: awayPlayer,
      homeTeam: teamById.get(home.teamId ?? -1)?.name ?? null,
      awayTeam: teamById.get(away.teamId ?? -1)?.name ?? null,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
    };
  };

  let bestAttack: Records["bestAttack"] = null;
  for (const [entryId, goals] of goalsByEntry) {
    if (goals === 0 || (bestAttack && goals <= bestAttack.goals)) continue;
    const entry = entryById.get(entryId);
    const player = entry && playerById.get(entry.playerId);
    const edition = entry && editionById.get(entry.editionId);
    if (player && edition) bestAttack = { player, edition, goals };
  }

  // Finais: o jogo do mata-mata com a maior rodada de cada edição.
  const lastRound = new Map<number, number>();
  for (const m of data.matches)
    if (m.stage === "mata")
      lastRound.set(
        m.editionId,
        Math.max(lastRound.get(m.editionId) ?? 0, m.round),
      );
  let finalRout: Match | null = null;
  let finalGoals: Match | null = null;
  let longestShootout: Match | null = null;
  const pens = (m: Match) => (m.homePens ?? 0) + (m.awayPens ?? 0);
  const goalsByEdition = new Map<number, { games: number; goals: number }>();
  for (const m of data.matches) {
    if (!isPlayed(m)) continue;
    const g = goalsByEdition.get(m.editionId) ?? { games: 0, goals: 0 };
    g.games++;
    g.goals += total(m);
    goalsByEdition.set(m.editionId, g);
    if (m.homePens != null && m.awayPens != null && m.homePens !== m.awayPens) {
      if (!longestShootout || pens(m) > pens(longestShootout))
        longestShootout = m;
    }
    if (m.stage !== "mata" || m.round !== lastRound.get(m.editionId)) continue;
    if (
      diff(m) > 0 &&
      (!finalRout ||
        diff(m) > diff(finalRout) ||
        (diff(m) === diff(finalRout) && total(m) > total(finalRout)))
    )
      finalRout = m;
    if (total(m) > 0 && (!finalGoals || total(m) > total(finalGoals)))
      finalGoals = m;
  }

  let goalFest: Records["goalFest"] = null;
  for (const [editionId, g] of goalsByEdition) {
    const edition = editionById.get(editionId);
    if (!edition || g.games < 3 || g.goals === 0) continue;
    const best = goalFest as Records["goalFest"];
    if (!best || g.goals / g.games > best.goals / best.games)
      goalFest = { edition, ...g };
  }

  const shootout = longestShootout as Match | null;
  const shootoutRecord = shootout && describe(shootout);

  return {
    biggestWin: describe(biggestWin),
    mostGoals: describe(mostGoals),
    bestAttack,
    finalRout: describe(finalRout),
    finalGoals: describe(finalGoals),
    longestShootout:
      shootout && shootoutRecord
        ? {
            ...shootoutRecord,
            homePens: shootout.homePens!,
            awayPens: shootout.awayPens!,
          }
        : null,
    goalFest,
    ...computeRecordsByPlayer(data),
  };
}

/** Jogos disputados em ordem: edição, fase de grupos, mata-mata por rodada. */
function playedInOrder(data: AllData) {
  const editionRank = new Map(
    [...data.editions]
      .sort(
        (a, b) =>
          a.number - b.number ||
          (a.playedOn ?? "").localeCompare(b.playedOn ?? ""),
      )
      .map((e, i) => [e.id, i]),
  );
  const key = (m: Match) => [
    editionRank.get(m.editionId) ?? 0,
    m.stage === "grupo" ? 0 : m.stage === "repescagem" ? 1 : 2,
    m.round,
    m.stage === "terceiro" ? 0 : 1,
    m.slot,
  ];
  return data.matches.filter(isPlayed).sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++)
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.id - b.id;
  });
}

function computeRecordsByPlayer(
  data: AllData,
): Omit<
  Records,
  | "biggestWin"
  | "mostGoals"
  | "bestAttack"
  | "finalRout"
  | "finalGoals"
  | "longestShootout"
  | "goalFest"
> {
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const playerById = new Map(data.players.map((p) => [p.id, p]));
  const editionById = new Map(data.editions.map((e) => [e.id, e]));
  const matches = playedInOrder(data);

  // Confrontos diretos, campanhas por inscrição e pênaltis.
  const pairs = new Map<
    string,
    { a: number; b: number; aw: number; bw: number; d: number }
  >();
  const campaigns = new Map<number, Record_>();
  const shootouts = new Map<number, { won: number; total: number }>();
  const runs = new Map<number, { games: number; from: number }>();
  let unbeatenRun: Records["unbeatenRun"] = null;
  const winRuns = new Map<number, { games: number; from: number }>();
  const dryRuns = new Map<number, { games: number; from: number }>();
  let winStreak: Streak | null = null;
  let drought: Streak | null = null;
  /** Soma um jogo à sequência (ou zera) e guarda o recorde. */
  const step = (
    map: Map<number, { games: number; from: number }>,
    playerId: number,
    editionId: number,
    keep: boolean,
    best: Streak | null,
  ): Streak | null => {
    if (!keep) {
      map.delete(playerId);
      return best;
    }
    const run = map.get(playerId);
    const next = run
      ? { games: run.games + 1, from: run.from }
      : { games: 1, from: editionId };
    map.set(playerId, next);
    const player = playerById.get(playerId);
    const from = editionById.get(next.from);
    const to = editionById.get(editionId);
    if (
      player &&
      from &&
      to &&
      next.games >= 2 &&
      (!best || next.games > best.count)
    )
      return { player, count: next.games, from, to };
    return best;
  };

  for (const m of matches) {
    const home = entryById.get(m.homeEntryId!);
    const away = entryById.get(m.awayEntryId!);
    if (!home || !away || home.playerId === away.playerId) continue;
    const hs = m.homeScore!;
    const as = m.awayScore!;

    const [a, b] = home.playerId < away.playerId ? [home, away] : [away, home];
    const [sa, sb] = a === home ? [hs, as] : [as, hs];
    const pk = `${a.playerId}:${b.playerId}`;
    const pair = pairs.get(pk) ?? {
      a: a.playerId,
      b: b.playerId,
      aw: 0,
      bw: 0,
      d: 0,
    };
    if (sa > sb) pair.aw++;
    else if (sb > sa) pair.bw++;
    else pair.d++;
    pairs.set(pk, pair);

    for (const [entry, gf, ga] of [
      [home, hs, as],
      [away, as, hs],
    ] as const) {
      const rec = campaigns.get(entry.id) ?? emptyRecord();
      addGame(rec, gf, ga);
      campaigns.set(entry.id, rec);

      winStreak = step(
        winRuns,
        entry.playerId,
        m.editionId,
        gf > ga,
        winStreak,
      );
      drought = step(dryRuns, entry.playerId, m.editionId, gf <= ga, drought);

      // Sequência sem perder, atravessando as edições.
      const run = runs.get(entry.playerId);
      if (gf < ga) runs.delete(entry.playerId);
      else {
        const next = run
          ? { games: run.games + 1, from: run.from }
          : { games: 1, from: m.editionId };
        runs.set(entry.playerId, next);
        const player = playerById.get(entry.playerId);
        const from = editionById.get(next.from);
        const to = editionById.get(m.editionId);
        if (
          player &&
          from &&
          to &&
          (!unbeatenRun || next.games > unbeatenRun.games)
        )
          unbeatenRun = { player, games: next.games, from, to };
      }
    }

    if (
      hs === as &&
      m.homePens != null &&
      m.awayPens != null &&
      m.homePens !== m.awayPens
    ) {
      for (const [entry, won] of [
        [home, m.homePens > m.awayPens],
        [away, m.awayPens > m.homePens],
      ] as const) {
        const rec = shootouts.get(entry.playerId) ?? { won: 0, total: 0 };
        rec.total++;
        if (won) rec.won++;
        shootouts.set(entry.playerId, rec);
      }
    }
  }

  let rivalry: Records["rivalry"] = null;
  let best = { gap: 0, games: 0 };
  for (const p of pairs.values()) {
    const games = p.aw + p.bw + p.d;
    const gap = Math.abs(p.aw - p.bw);
    if (games < 3 || gap === 0) continue;
    if (gap < best.gap || (gap === best.gap && games <= best.games)) continue;
    const aWins = p.aw > p.bw;
    const winner = playerById.get(aWins ? p.a : p.b);
    const loser = playerById.get(aWins ? p.b : p.a);
    if (!winner || !loser) continue;
    best = { gap, games };
    rivalry = {
      winner,
      loser,
      wins: Math.max(p.aw, p.bw),
      losses: Math.min(p.aw, p.bw),
      draws: p.d,
    };
  }

  const unbeatenChampions: Records["unbeatenChampions"] = [];
  let worstCampaign: Records["worstCampaign"] = null;
  for (const [entryId, rec] of campaigns) {
    const entry = entryById.get(entryId);
    const player = entry && playerById.get(entry.playerId);
    const edition = entry && editionById.get(entry.editionId);
    if (!entry || !player || !edition) continue;
    if (entry.result === "campeao" && rec.losses === 0)
      unbeatenChampions.push({
        player,
        edition,
        wins: rec.wins,
        draws: rec.draws,
      });
    if (rec.played < 2) continue;
    const points = rec.wins * 3 + rec.draws;
    const w = worstCampaign as Records["worstCampaign"];
    const worse =
      !w ||
      points < w.points ||
      (points === w.points &&
        (rec.gf - rec.ga < w.gf - w.ga ||
          (rec.gf - rec.ga === w.gf - w.ga && rec.ga > w.ga)));
    if (worse)
      worstCampaign = {
        player,
        edition,
        played: rec.played,
        points,
        gf: rec.gf,
        ga: rec.ga,
      };
  }
  unbeatenChampions.sort(
    (a, b) =>
      b.edition.number - a.edition.number ||
      (b.edition.playedOn ?? "").localeCompare(a.edition.playedOn ?? ""),
  );

  let penaltyKing: Records["penaltyKing"] = null;
  for (const [playerId, rec] of shootouts) {
    if (rec.won === 0) continue;
    const k = penaltyKing as Records["penaltyKing"];
    if (k && (rec.won < k.won || (rec.won === k.won && rec.total >= k.total)))
      continue;
    const player = playerById.get(playerId);
    if (player) penaltyKing = { player, ...rec };
  }

  let classic: Records["classic"] = null;
  let classicGames = 0;
  for (const p of pairs.values()) {
    const games = p.aw + p.bw + p.d;
    if (games < 2 || games <= classicGames) continue;
    const a = playerById.get(p.a);
    const b = playerById.get(p.b);
    if (!a || !b) continue;
    classicGames = games;
    // Quem venceu mais aparece primeiro.
    classic =
      p.aw >= p.bw
        ? { a, b, aWins: p.aw, bWins: p.bw, draws: p.d }
        : { a: b, b: a, aWins: p.bw, bWins: p.aw, draws: p.d };
  }

  let bestDefense: Records["bestDefense"] = null;
  let bestGoalDiff: Records["bestGoalDiff"] = null;
  for (const [entryId, rec] of campaigns) {
    const entry = entryById.get(entryId);
    const player = entry && playerById.get(entry.playerId);
    const edition = entry && editionById.get(entry.editionId);
    if (!entry || !player || !edition) continue;
    const gd = rec.gf - rec.ga;
    const g = bestGoalDiff as Records["bestGoalDiff"];
    if (gd > 0 && (!g || gd > g.gd || (gd === g.gd && rec.played < g.played)))
      bestGoalDiff = { player, edition, played: rec.played, gd };
    if (rec.played < 3) continue;
    const d = bestDefense as Records["bestDefense"];
    const rate = rec.ga / rec.played;
    if (
      !d ||
      rate < d.ga / d.played ||
      (rate === d.ga / d.played && rec.played > d.played)
    )
      bestDefense = { player, edition, played: rec.played, ga: rec.ga };
  }

  // Títulos e finais em edições seguidas (só as edições que já têm campeão).
  const decided = [...data.editions]
    .filter((e) =>
      data.entries.some((x) => x.editionId === e.id && x.result === "campeao"),
    )
    .sort(
      (a, b) =>
        a.number - b.number ||
        (a.playedOn ?? "").localeCompare(b.playedOn ?? ""),
    );
  const editionStreak = (codes: string[]): Streak | null => {
    let best: Streak | null = null;
    let current = new Map<number, { count: number; from: Edition }>();
    for (const edition of decided) {
      const next = new Map<number, { count: number; from: Edition }>();
      for (const x of data.entries) {
        if (x.editionId !== edition.id || !codes.includes(x.result ?? ""))
          continue;
        const prev = current.get(x.playerId);
        const run = prev
          ? { count: prev.count + 1, from: prev.from }
          : { count: 1, from: edition };
        next.set(x.playerId, run);
        const player = playerById.get(x.playerId);
        if (player && run.count >= 2 && (!best || run.count > best.count))
          best = { player, count: run.count, from: run.from, to: edition };
      }
      current = next;
    }
    return best;
  };

  return {
    rivalry,
    unbeatenRun,
    unbeatenChampions,
    worstCampaign,
    penaltyKing,
    bestDefense,
    bestGoalDiff,
    winStreak,
    drought,
    titleStreak: editionStreak(["campeao"]),
    finalsStreak: editionStreak(["campeao", "vice"]),
    classic,
  };
}

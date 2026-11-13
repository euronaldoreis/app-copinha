// Estatísticas históricas, calculadas a partir de todas as edições.
import type { Edition, Entry, Match, Player, Team } from "@/db/schema";
import { resultRank } from "./labels";

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

  return {
    biggestWin: describe(biggestWin),
    mostGoals: describe(mostGoals),
    bestAttack,
  };
}

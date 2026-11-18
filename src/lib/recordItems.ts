// Cartões do mural de recordes, montados no servidor a partir dos recordes.
import type { Player } from "@/db/schema";
import type { RecordItem, RecordPerson } from "@/components/RecordsBoard";
import { plural } from "./labels";
import type { MatchRecord, Records } from "./stats";

/** Só o que o mural precisa de cada jogador (nada além disso vai ao navegador). */
const person = (p: Player): RecordPerson => ({
  id: p.id,
  name: p.name,
  photoUrl: p.photoUrl,
  avatar: p.avatar,
});

const matchDetail = (m: MatchRecord) =>
  [
    m.homeTeam && m.awayTeam ? `${m.homeTeam} × ${m.awayTeam}` : null,
    m.edition.name,
  ]
    .filter(Boolean)
    .join(" · ");

const span = (
  from: { id: number; name: string },
  to: { id: number; name: string },
) => (from.id === to.id ? `Na ${from.name}` : `De ${from.name} a ${to.name}`);

/** Monta os cartões do mural de recordes: lendas primeiro, depois os vexames. */
export function recordItems(r: Records): RecordItem[] {
  const items: RecordItem[] = [];

  if (r.unbeatenRun) {
    const { player, games, from, to } = r.unbeatenRun;
    items.push({
      id: "invicto",
      kind: "lenda",
      title: "Ninguém segura",
      tagline: "Maior sequência sem perder",
      layout: {
        type: "single",
        person: person(player),
        value: games,
        unit: "jogos sem perder",
      },
      detail:
        from.id === to.id ? `Na ${from.name}` : `De ${from.name} a ${to.name}`,
      share: `${player.name} ficou ${games} jogos sem perder na Copinha dos Lixos. Alguém para esse cara?`,
    });
  }
  if (r.bestAttack) {
    const { player, goals, edition } = r.bestAttack;
    items.push({
      id: "ataque",
      kind: "lenda",
      title: "Máquina de gols",
      tagline: "Melhor ataque em uma edição",
      layout: {
        type: "single",
        person: person(player),
        value: goals,
        unit: "gols numa edição",
      },
      detail: edition.name,
      share: `${player.name} meteu ${goals} gols numa edição só da Copinha dos Lixos (${edition.name}).`,
    });
  }
  if (r.penaltyKing) {
    const { player, won, total } = r.penaltyKing;
    items.push({
      id: "penaltis",
      kind: "lenda",
      title: "Rei dos pênaltis",
      tagline: "Frieza na marca da cal",
      layout: {
        type: "single",
        person: person(player),
        value: won,
        unit: won === 1 ? "disputa vencida" : "disputas vencidas",
      },
      detail: `Venceu ${won} de ${plural(total, "disputa", "disputas")}`,
      share: `${player.name} é o rei dos pênaltis da Copinha dos Lixos: ${won} de ${total} disputas vencidas.`,
    });
  }
  if (r.unbeatenChampions.length > 0) {
    const list = r.unbeatenChampions;
    items.push({
      id: "campeao-invicto",
      kind: "lenda",
      title: list.length > 1 ? "Campeões invictos" : "Campeão invicto",
      tagline: "Levantaram a taça sem perder um jogo",
      layout: {
        type: "list",
        people: list.slice(0, 5).map((c) => ({
          person: person(c.player),
          text: `${c.edition.name} · ${c.wins}V ${c.draws}E`,
        })),
        more: Math.max(0, list.length - 5),
      },
      detail: plural(list.length, "taça invicta", "taças invictas"),
      share: `Campeão invicto da Copinha dos Lixos: ${list[0].player.name} (${list[0].edition.name}). Sem perder um jogo!`,
    });
  }
  if (r.mostGoals) {
    const m = r.mostGoals;
    items.push({
      id: "jogaco",
      kind: "lenda",
      title: "Jogaço",
      tagline: `O jogo com mais gols da história: ${plural(m.homeScore + m.awayScore, "gol", "gols")}`,
      layout: {
        type: "versus",
        left: person(m.home),
        right: person(m.away),
        leftValue: m.homeScore,
        rightValue: m.awayScore,
      },
      detail: matchDetail(m),
      share: `Jogaço na Copinha dos Lixos: ${m.home.name} ${m.homeScore} x ${m.awayScore} ${m.away.name}.`,
    });
  }

  if (r.titleStreak) {
    const { player, count, from, to } = r.titleStreak;
    items.push({
      id: "dinastia",
      kind: "lenda",
      title: "Dinastia",
      tagline: "Títulos em edições seguidas",
      layout: {
        type: "single",
        person: person(player),
        value: count,
        unit: "títulos seguidos",
      },
      detail: `De ${from.name} a ${to.name}`,
      share: `${player.name} foi campeão ${count} vezes seguidas na Copinha dos Lixos. Dinastia!`,
    });
  }
  if (r.winStreak) {
    const { player, count, from, to } = r.winStreak;
    items.push({
      id: "embalado",
      kind: "lenda",
      title: "Embalado",
      tagline: "Mais vitórias seguidas",
      layout: {
        type: "single",
        person: person(player),
        value: count,
        unit: "vitórias seguidas",
      },
      detail: span(from, to),
      share: `${player.name} ganhou ${count} jogos seguidos na Copinha dos Lixos.`,
    });
  }
  if (r.finalsStreak) {
    const { player, count, from, to } = r.finalsStreak;
    items.push({
      id: "finais-seguidas",
      kind: "lenda",
      title: "Figurinha de final",
      tagline: "Finais em edições seguidas",
      layout: {
        type: "single",
        person: person(player),
        value: count,
        unit: "finais seguidas",
      },
      detail: `De ${from.name} a ${to.name}`,
      share: `${player.name} chegou a ${count} finais seguidas na Copinha dos Lixos.`,
    });
  }
  if (r.bestDefense) {
    const { player, edition, played, ga } = r.bestDefense;
    items.push({
      id: "muralha",
      kind: "lenda",
      title: "Muralha",
      tagline: "Menos gols sofridos por jogo numa edição",
      layout: {
        type: "single",
        person: person(player),
        value: ga,
        unit: `${ga === 1 ? "gol sofrido" : "gols sofridos"} em ${plural(played, "jogo", "jogos")}`,
      },
      detail: edition.name,
      share: `${player.name} tomou só ${plural(ga, "gol", "gols")} em ${plural(played, "jogo", "jogos")} na ${edition.name}. Muralha!`,
    });
  }
  if (r.bestGoalDiff) {
    const { player, edition, played, gd } = r.bestGoalDiff;
    items.push({
      id: "atropelo",
      kind: "lenda",
      title: "Atropelo",
      tagline: "Maior saldo de gols numa edição",
      layout: {
        type: "single",
        person: person(player),
        value: gd,
        prefix: "+",
        unit: "de saldo",
      },
      detail: `${edition.name} · ${plural(played, "jogo", "jogos")}`,
      share: `${player.name} terminou a ${edition.name} com +${gd} de saldo. Atropelou geral.`,
    });
  }
  if (r.finalGoals) {
    const m = r.finalGoals;
    items.push({
      id: "final-cinema",
      kind: "lenda",
      title: "Final de cinema",
      tagline: `A final com mais gols: ${plural(m.homeScore + m.awayScore, "gol", "gols")}`,
      layout: {
        type: "versus",
        left: person(m.home),
        right: person(m.away),
        leftValue: m.homeScore,
        rightValue: m.awayScore,
      },
      detail: matchDetail(m),
      share: `Final de cinema na Copinha dos Lixos: ${m.home.name} ${m.homeScore} x ${m.awayScore} ${m.away.name}.`,
    });
  }
  if (r.longestShootout) {
    const m = r.longestShootout;
    const homeWon = m.homePens > m.awayPens;
    const [w, l, wp, lp] = homeWon
      ? [m.home, m.away, m.homePens, m.awayPens]
      : [m.away, m.home, m.awayPens, m.homePens];
    items.push({
      id: "coracao",
      kind: "lenda",
      title: "Coração na boca",
      tagline: "A disputa de pênaltis mais longa",
      layout: {
        type: "versus",
        left: person(w),
        right: person(l),
        leftValue: wp,
        rightValue: lp,
        loserLabel: "Perdeu",
      },
      detail: `${m.homeScore} x ${m.awayScore} no jogo · ${matchDetail(m)}`,
      share: `${w.name} ganhou de ${l.name} por ${wp} a ${lp} nos pênaltis na Copinha dos Lixos. Coração na boca.`,
    });
  }
  // O clássico só aparece se não for a mesma dupla da maior freguesia.
  const samePair =
    r.classic &&
    r.rivalry &&
    [r.classic.a.id, r.classic.b.id].sort().join() ===
      [r.rivalry.winner.id, r.rivalry.loser.id].sort().join();
  if (r.classic && !samePair) {
    const { a, b, aWins, bWins, draws } = r.classic;
    const games = aWins + bWins + draws;
    items.push({
      id: "classico",
      kind: "lenda",
      title: "O clássico",
      tagline: `Mais vezes frente a frente: ${plural(games, "jogo", "jogos")}`,
      layout: {
        type: "versus",
        left: person(a),
        right: person(b),
        leftValue: aWins,
        rightValue: bWins,
      },
      detail: `Vitórias no confronto${draws ? ` · ${plural(draws, "empate", "empates")}` : ""}`,
      share: `O clássico da Copinha dos Lixos: ${a.name} x ${b.name}, ${games} jogos. ${aWins} a ${bWins} em vitórias.`,
    });
  }
  if (r.goalFest) {
    const { edition, games, goals } = r.goalFest;
    const avg = Math.round((goals / games) * 10) / 10;
    items.push({
      id: "chuva",
      kind: "lenda",
      title: "Chuva de gols",
      tagline: "A edição com mais gols por jogo",
      layout: {
        type: "stat",
        value: avg,
        decimals: 1,
        unit: "gols por jogo",
        caption: edition.name,
      },
      detail: `${plural(goals, "gol", "gols")} em ${plural(games, "jogo", "jogos")}`,
      share: `A ${edition.name} teve ${avg.toLocaleString("pt-BR")} gols por jogo. Chuva de gols!`,
    });
  }

  if (r.biggestWin) {
    const m = r.biggestWin;
    const homeWon = m.homeScore > m.awayScore;
    const [w, l, ws, ls] = homeWon
      ? [m.home, m.away, m.homeScore, m.awayScore]
      : [m.away, m.home, m.awayScore, m.homeScore];
    items.push({
      id: "sacode",
      kind: "vexame",
      title: "Maior sacode",
      tagline: "Tem placar que não se apaga",
      layout: {
        type: "versus",
        left: person(w),
        right: person(l),
        leftValue: ws,
        rightValue: ls,
        loserLabel: "Tomou",
      },
      detail: matchDetail(m),
      share: `${l.name} tomou ${ws} a ${ls} de ${w.name} na Copinha dos Lixos. Maior sacode da história.`,
    });
  }
  if (r.rivalry) {
    const { winner, loser, wins, losses, draws } = r.rivalry;
    items.push({
      id: "fregues",
      kind: "vexame",
      title: "Freguês de carteirinha",
      tagline: "Maior freguesia no confronto direto",
      layout: {
        type: "versus",
        left: person(winner),
        right: person(loser),
        leftValue: wins,
        rightValue: losses,
        loserLabel: "Freguês",
      },
      detail: `Vitórias no confronto direto${draws ? ` · ${plural(draws, "empate", "empates")}` : ""}`,
      share: `${loser.name} é freguês de ${winner.name} na Copinha dos Lixos: ${wins} a ${losses} no confronto direto.`,
    });
  }
  if (r.worstCampaign) {
    const { player, edition, played, points, gf, ga } = r.worstCampaign;
    items.push({
      id: "lixo",
      kind: "vexame",
      title: "Lixo do lixo",
      tagline: "A pior campanha numa edição",
      layout: {
        type: "single",
        person: person(player),
        value: points,
        unit: points === 1 ? "ponto" : "pontos",
      },
      detail: `${edition.name} · ${plural(played, "jogo", "jogos")}, ${plural(gf, "gol pró", "gols pró")} e ${ga} contra`,
      share: `${player.name} fez ${plural(points, "ponto", "pontos")} e tomou ${ga} gols na ${edition.name}. O lixo do lixo da Copinha.`,
    });
  }
  if (r.finalRout) {
    const m = r.finalRout;
    const homeWon = m.homeScore > m.awayScore;
    const [w, l, ws, ls] = homeWon
      ? [m.home, m.away, m.homeScore, m.awayScore]
      : [m.away, m.home, m.awayScore, m.homeScore];
    items.push({
      id: "final-atropelo",
      kind: "vexame",
      title: "Atropelado na final",
      tagline: "A final mais desequilibrada",
      layout: {
        type: "versus",
        left: person(w),
        right: person(l),
        leftValue: ws,
        rightValue: ls,
        loserLabel: "Vice",
      },
      detail: matchDetail(m),
      share: `${l.name} chegou na final e tomou ${ws} a ${ls} de ${w.name} na Copinha dos Lixos.`,
    });
  }
  if (r.drought) {
    const { player, count, from, to } = r.drought;
    items.push({
      id: "seca",
      kind: "vexame",
      title: "Seca braba",
      tagline: "Mais jogos seguidos sem vencer",
      layout: {
        type: "single",
        person: person(player),
        value: count,
        unit: "jogos sem vencer",
      },
      detail: span(from, to),
      share: `${player.name} ficou ${count} jogos sem vencer na Copinha dos Lixos. Seca braba.`,
    });
  }
  return items;
}

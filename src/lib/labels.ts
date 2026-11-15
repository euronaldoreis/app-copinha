import type { Format, Pairing, ResultCode } from "./tournament";

export const FORMAT_LABELS: Record<Format, string> = {
  grupos: "Grupos + mata-mata",
  liga: "Pontos corridos",
  mata: "Mata-mata",
  manual: "Registro histórico",
};

export const PAIRING_LABELS: Record<Pairing, string> = {
  interno: "Dentro do grupo",
  cruzado: "Contra o outro grupo",
  misto: "Misto: dentro e contra",
};

/** Explicação curta de cada tipo de confronto, para quem está vendo a tabela. */
export const PAIRING_NOTES: Record<Pairing, string> = {
  interno: "Cada um enfrenta os do próprio grupo",
  cruzado: "Cada um enfrenta todos do outro grupo",
  misto: "Cada um enfrenta o próprio grupo e o outro",
};

export function pairingNote(pairing: string, crossGames: number) {
  if (pairing === "misto" && crossGames > 0)
    return `Cada um enfrenta o próprio grupo e ${crossGames} do outro`;
  return PAIRING_NOTES[pairing as Pairing] ?? "";
}

export const STATUS_LABELS: Record<string, string> = {
  inscricoes: "Inscrições",
  andamento: "Em andamento",
  encerrada: "Encerrada",
};

export const RESULT_LABELS: Record<ResultCode, string> = {
  campeao: "Campeão",
  vice: "Vice-campeão",
  terceiro: "3º lugar",
  quarto: "4º lugar",
  semifinal: "Semifinal",
  quartas: "Quartas de final",
  oitavas: "Oitavas de final",
  eliminado: "Eliminado no mata-mata",
  grupos: "Fase de grupos",
  liga: "Pontos corridos",
  participou: "Participou",
};

/** Ordem de importância das colocações (menor = melhor). */
export const RESULT_ORDER: ResultCode[] = [
  "campeao",
  "vice",
  "terceiro",
  "quarto",
  "semifinal",
  "quartas",
  "oitavas",
  "eliminado",
  "grupos",
  "liga",
  "participou",
];

export function resultLabel(code: string | null | undefined) {
  if (!code) return "";
  return RESULT_LABELS[code as ResultCode] ?? code;
}

export function resultRank(code: string | null | undefined) {
  const i = RESULT_ORDER.indexOf(code as ResultCode);
  return i === -1 ? RESULT_ORDER.length : i;
}

export function roundLabel(round: number, totalRounds: number) {
  const size = 2 ** (totalRounds - round + 1);
  if (size === 2) return "Final";
  if (size === 4) return "Semifinal";
  if (size === 8) return "Quartas de final";
  if (size === 16) return "Oitavas de final";
  return `Fase de ${size}`;
}

/** Texto para uma vaga do mata-mata que ainda não tem dono. */
export function sourceLabel(
  source: string | null,
  format: string,
  totalRounds: number,
) {
  if (!source) return "A definir";
  const [kind, a, b] = source.split(":");
  if (kind === "G") {
    return format === "liga" ? `${b}º colocado` : `${b}º do Grupo ${a}`;
  }
  if (kind === "B") return `${b}º melhor ${a}º colocado`;
  const name = `${roundLabel(Number(a), totalRounds)} ${Number(b) + 1}`;
  return kind === "W" ? `Vencedor ${name}` : `Perdedor ${name}`;
}

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-03-14" -> "14 mar 2026". Sem Date para não sofrer com fuso horário. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

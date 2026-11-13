"use client";

import { useState } from "react";
import { FORMAT_LABELS, PAIRING_LABELS, plural } from "@/lib/labels";
import {
  countMatches,
  groupGamesPerEntry,
  groupSizes,
  PAIRINGS,
  validateConfig,
  type Format,
  type FormatConfig,
  type Pairing,
} from "@/lib/tournament";

const DESCRIPTIONS: Record<Format, string> = {
  grupos: "Fase de grupos e depois semifinais e final.",
  liga: "Todos contra todos, com ou sem final.",
  mata: "Chaveamento direto: perdeu, está fora.",
  manual: "Edição antiga: só participantes e colocações.",
};

export const DEFAULT_CONFIG: FormatConfig = {
  format: "grupos",
  groupsCount: 2,
  legs: 1,
  pairing: "interno",
  crossGames: 0,
  qualifiers: 4,
  thirdPlace: true,
};

const PAIRING_HELP: Record<Pairing, string> = {
  interno: "",
  cruzado:
    "Ninguém joga contra o próprio grupo: cada um enfrenta todos do grupo vizinho (A com B, C com D). A classificação continua separada por grupo.",
  misto:
    "Primeiro todos jogam dentro do próprio grupo e depois contra o grupo vizinho (A com B, C com D). A classificação continua separada por grupo.",
};

/** Resumo do que a configuração gera, ou o motivo de ela não servir. */
function Preview({ config, n }: { config: FormatConfig; n: number }) {
  if (config.format === "manual") return null;
  if (n < 2) {
    return (
      <p className="text-body text-muted">
        Escolha os participantes para ver quantos jogos serão.
      </p>
    );
  }
  const problem = validateConfig(config, n);
  if (problem) return <p className="text-body text-danger">{problem}</p>;
  const { group, knockout } = countMatches(config, n);
  const parts: string[] = [];
  if (config.format === "grupos") {
    const sizes = groupSizes(n, config.groupsCount);
    const same = sizes.every((s) => s === sizes[0]);
    parts.push(
      same
        ? `${config.groupsCount} grupos de ${sizes[0]}`
        : `${config.groupsCount} grupos (${sizes.join(", ")})`,
    );
  }
  if (group) {
    parts.push(
      `${plural(group, "jogo", "jogos")} ${config.format === "liga" ? "nos pontos corridos" : "na fase de grupos"}`,
    );
  }
  if (knockout) parts.push(`${plural(knockout, "jogo", "jogos")} de mata-mata`);
  const per = groupGamesPerEntry(config, n);
  const phase = config.format === "liga" ? "nos pontos corridos" : "na fase de grupos";
  return (
    <p className="text-body text-muted">
      {plural(n, "participante", "participantes")}: {parts.join(", ")}.
      {per &&
        (per.min === per.max
          ? ` Cada um faz ${plural(per.min, "jogo", "jogos")} ${phase}.`
          : ` Cada um faz de ${per.min} a ${per.max} jogos ${phase}.`)}
    </p>
  );
}

/**
 * Escolha do formato e das regras. Renderiza inputs nativos (com `name`), então
 * funciona tanto em formulário comum quanto controlado via `onChange`.
 */
export function FormatFields({
  initial = DEFAULT_CONFIG,
  participants,
  allowManual = true,
  onChange,
}: {
  initial?: FormatConfig;
  participants: number;
  allowManual?: boolean;
  onChange?: (config: FormatConfig) => void;
}) {
  const [config, setConfig] = useState(initial);
  const update = (patch: Partial<FormatConfig>) => {
    const next = { ...config, ...patch };
    // Ao trocar de formato, parte de valores que fazem sentido para ele.
    if (patch.format === "liga" && ![0, 2, 4, 8].includes(next.qualifiers))
      next.qualifiers = 2;
    if (patch.format === "grupos") {
      if (next.groupsCount < 2) next.groupsCount = 2;
      if (next.qualifiers < 2) next.qualifiers = 4;
    }
    setConfig(next);
    onChange?.(next);
  };

  const formats = (Object.keys(FORMAT_LABELS) as Format[]).filter(
    (f) => allowManual || f !== "manual",
  );
  const hasGroupStage = config.format === "grupos" || config.format === "liga";
  const mixed = config.format === "grupos" && config.pairing === "misto";
  // Opções de 1 até "todos menos um"; sem participantes ainda, oferece até 7.
  // Só existe no misto: em mata-mata e pontos corridos groupsCount é 0 ou 1 e
  // a conta abaixo não faz sentido (dividir por zero quebrava a página).
  const groupSize =
    config.groupsCount >= 2 && participants >= config.groupsCount * 2
      ? Math.floor(participants / config.groupsCount)
      : 8;
  const crossOptions = mixed
    ? Array.from(
        { length: Math.max(groupSize - 1, config.crossGames) },
        (_, i) => i + 1,
      )
    : [];
  const canHaveThird =
    config.format === "mata" ||
    (hasGroupStage && config.qualifiers >= 4);

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="label">Formato</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {formats.map((f) => (
            <label
              key={f}
              className={`cursor-pointer rounded-card px-4 py-3 ${
                config.format === f ? "bg-accent-wash" : "bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="format"
                value={f}
                checked={config.format === f}
                onChange={() => update({ format: f })}
                className="sr-only"
              />
              <span className="block text-name font-semibold">
                {FORMAT_LABELS[f]}
              </span>
              <span className="block text-body text-muted">
                {DESCRIPTIONS[f]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {config.format !== "manual" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {config.format === "grupos" && (
            <label>
              <span className="label">Grupos</span>
              <select
                name="groupsCount"
                className="field"
                value={config.groupsCount}
                onChange={(e) => update({ groupsCount: Number(e.target.value) })}
              >
                {[2, 3, 4, 5, 6, 8].map((g) => (
                  <option key={g} value={g}>
                    {g} grupos
                  </option>
                ))}
              </select>
            </label>
          )}
          {config.format === "grupos" && (
            <label>
              <span className="label">Confrontos</span>
              <select
                name="pairing"
                className="field"
                value={config.pairing}
                onChange={(e) => update({ pairing: e.target.value as Pairing })}
              >
                {PAIRINGS.map((p) => (
                  <option key={p} value={p}>
                    {PAIRING_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mixed && (
            <label>
              <span className="label">Jogos contra o outro grupo</span>
              <select
                name="crossGames"
                className="field"
                value={config.crossGames}
                onChange={(e) => update({ crossGames: Number(e.target.value) })}
              >
                <option value={0}>Contra todos</option>
                {crossOptions.map((k) => (
                  <option key={k} value={k}>
                    {config.legs === 2
                      ? `${plural(k, "adversário", "adversários")}, ida e volta`
                      : plural(k, "jogo", "jogos")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasGroupStage && (
            <label>
              <span className="label">Turnos</span>
              <select
                name="legs"
                className="field"
                value={config.legs}
                onChange={(e) => update({ legs: Number(e.target.value) })}
              >
                <option value={1}>Turno único</option>
                <option value={2}>Ida e volta</option>
              </select>
            </label>
          )}
          {hasGroupStage && (
            <label>
              <span className="label">
                {config.format === "liga" ? "Decisão" : "Classificados"}
              </span>
              <select
                name="qualifiers"
                className="field"
                value={config.qualifiers}
                onChange={(e) => update({ qualifiers: Number(e.target.value) })}
              >
                {config.format === "liga" && (
                  <option value={0}>Campeão por pontos</option>
                )}
                <option value={2}>
                  {config.format === "liga" ? "Final entre os 2 primeiros" : "2 (final)"}
                </option>
                <option value={4}>
                  {config.format === "liga" ? "Semifinais com os 4 primeiros" : "4 (semifinais)"}
                </option>
                <option value={8}>
                  {config.format === "liga" ? "Quartas com os 8 primeiros" : "8 (quartas)"}
                </option>
                {config.format === "grupos" && (
                  <option value={16}>16 (oitavas)</option>
                )}
              </select>
            </label>
          )}
        </div>
      )}

      {config.format === "grupos" && PAIRING_HELP[config.pairing] && (
        <p className="text-body text-muted">
          {PAIRING_HELP[config.pairing]}
          {mixed &&
            config.crossGames > 0 &&
            " Quem pega quem no outro grupo sai do sorteio."}
        </p>
      )}

      {canHaveThird && (
        <label className="flex items-center gap-2.5 text-body">
          <input
            type="checkbox"
            name="thirdPlace"
            checked={config.thirdPlace}
            onChange={(e) => update({ thirdPlace: e.target.checked })}
            className="size-4 accent-accent"
          />
          Disputa de 3º lugar
        </label>
      )}

      <Preview config={config} n={participants} />
    </div>
  );
}

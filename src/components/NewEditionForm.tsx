"use client";

import { useState, useTransition } from "react";
import { createEditionAction } from "@/app/actions";
import type { Player } from "@/db/schema";
import { DEFAULT_CONFIG, FormatFields } from "./FormatFields";

const split = (text: string, pattern: RegExp) =>
  text
    .split(pattern)
    .map((s) => s.trim())
    .filter(Boolean);

export function NewEditionForm({
  players,
  nextNumber,
  games,
}: {
  players: Player[];
  nextNumber: number;
  games: string[];
}) {
  const [number, setNumber] = useState(nextNumber);
  const [name, setName] = useState(`Copinha dos Lixos #${nextNumber}`);
  const [game, setGame] = useState(games[0] ?? "");
  const [playedOn, setPlayedOn] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [selected, setSelected] = useState<number[]>([]);
  const [newPlayers, setNewPlayers] = useState("");
  const [teamPool, setTeamPool] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const newNames = split(newPlayers, /[\n,;]/);
  const teams = split(teamPool, /\n/);
  const total = selected.length + newNames.length;

  const toggle = (id: number) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const changeNumber = (value: number) => {
    // Mantém o nome padrão acompanhando o número enquanto ele não for editado.
    if (/^Copinha dos Lixos #\d+$/.test(name))
      setName(`Copinha dos Lixos #${value || ""}`);
    setNumber(value);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const state = await createEditionAction({
        name,
        number,
        game,
        playedOn,
        config,
        playerIds: selected,
        newPlayerNames: newNames,
        teamPool: teams,
      });
      if (state?.error) setError(state.error);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="card flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label>
            <span className="label">Nome</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="label">Número</span>
            <input
              className="field num"
              type="number"
              min={1}
              value={number || ""}
              onChange={(e) => changeNumber(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Jogo</span>
            <input
              className="field"
              list="games"
              placeholder="FIFA 23, Bomba Patch..."
              value={game}
              onChange={(e) => setGame(e.target.value)}
              required
            />
            <datalist id="games">
              {[...new Set([...games, "FIFA", "Bomba Patch"])].map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="label">Data</span>
            <input
              className="field"
              type="date"
              value={playedOn}
              onChange={(e) => setPlayedOn(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="card p-5">
        <FormatFields participants={total} onChange={setConfig} />
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <div>
          <span className="label">
            Participantes{total > 0 && ` (${total})`}
          </span>
          {players.length > 0 && (
            <div className="-mx-1 mb-3 flex flex-wrap gap-1">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={selected.includes(p.id)}
                  onClick={() => toggle(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <input
            className="field"
            placeholder={
              players.length
                ? "Gente nova? Nomes separados por vírgula"
                : "Nomes separados por vírgula"
            }
            value={newPlayers}
            onChange={(e) => setNewPlayers(e.target.value)}
          />
        </div>

        {config.format !== "manual" && (
          <label>
            <span className="label">
              Times para o sorteio, um por linha
              {teams.length > 0 && ` (${teams.length})`}
            </span>
            <textarea
              className="field"
              rows={6}
              placeholder={"Íbis\nSan Marino\nTabajara FC"}
              value={teamPool}
              onChange={(e) => setTeamPool(e.target.value)}
            />
            <span className="mt-1.5 block text-body text-muted">
              Pode deixar para depois. Dá para ter mais times do que
              participantes: os que sobrarem ficam de fora.
            </span>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Criando..." : "Criar edição"}
        </button>
      </div>
    </form>
  );
}

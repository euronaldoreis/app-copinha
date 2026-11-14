"use client";

import { useState } from "react";
import { plural } from "@/lib/labels";
import type { AvatarLook } from "@/lib/sprite";
import { TrophyIcon } from "./icons";
import { PersonRow } from "./ui";

export interface PlayerItem {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  detail: string;
  titles: number;
}

/** Minúsculas e sem acento: "joao" encontra "João", "ITALO" encontra "Ítalo". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

/** Lista de jogadores com campo de pesquisa por nome. */
export function PlayersList({ players }: { players: PlayerItem[] }) {
  const [query, setQuery] = useState("");
  const words = normalize(query).split(/\s+/).filter(Boolean);
  // Todas as palavras digitadas precisam aparecer no nome.
  const shown = words.length
    ? players.filter((p) => {
        const name = normalize(p.name);
        return words.every((w) => name.includes(w));
      })
    : players;

  return (
    <>
      <div className="mb-4">
        <label>
          <span className="sr-only">Pesquisar jogador</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar jogador"
            autoComplete="off"
            className="field"
          />
        </label>
        {words.length > 0 && (
          <p className="mt-2 text-body text-muted" aria-live="polite">
            {shown.length === 0
              ? "Nenhum jogador encontrado."
              : `${shown.length} de ${plural(players.length, "jogador", "jogadores")}`}
          </p>
        )}
      </div>

      {shown.length > 0 && (
        <div className="card px-5 py-1.5">
          {shown.map((p) => (
            <PersonRow
              key={p.id}
              href={`/jogadores/${p.id}`}
              name={p.name}
              photoUrl={p.photoUrl}
              avatar={p.avatar}
              detail={p.detail}
              trailing={
                p.titles > 0 ? (
                  <span
                    className="num flex items-center gap-1 text-name font-semibold text-accent"
                    title={plural(p.titles, "título", "títulos")}
                  >
                    {p.titles}
                    <TrophyIcon width={18} height={18} />
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

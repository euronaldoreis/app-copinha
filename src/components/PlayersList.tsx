"use client";

import { useState } from "react";
import { plural } from "@/lib/labels";
import type { AvatarLook } from "@/lib/sprite";
import Link from "next/link";
import { TIER_LABELS, type Tier } from "@/lib/tier";
import { Avatar } from "./Avatar";
import { TrophyIcon } from "./icons";

export interface PlayerItem {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  detail: string;
  titles: number;
  tier: Tier;
  /** Participações: o "nível" da carta. */
  level: number;
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
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/jogadores/${p.id}`}
              className={`player-card tier-${p.tier}`}
              title={p.detail}
            >
              <span className="flex w-full items-center justify-between">
                <span className="player-badge">Nv {p.level}</span>
                <span
                  className="player-badge !px-1.5"
                  title={plural(p.titles, "título", "títulos")}
                >
                  <TrophyIcon width={14} height={14} className="text-accent" />
                  <span className="num">{p.titles}</span>
                </span>
              </span>
              <Avatar
                name={p.name}
                photoUrl={p.photoUrl}
                avatar={p.avatar}
                size={68}
                tier={false}
              />
              <span className="player-plate">
                <span className="text-title w-full truncate text-center !text-[16px] !leading-tight">
                  {p.name}
                </span>
                <span
                  className={`max-w-full truncate whitespace-nowrap text-center font-black uppercase text-muted ${
                    // "Super campeão" é longo: letra menor e sem espaço extra para caber
                    TIER_LABELS[p.tier].length > 10
                      ? "text-[9px] tracking-normal"
                      : "text-[10px] tracking-wide"
                  }`}
                >
                  {TIER_LABELS[p.tier]}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

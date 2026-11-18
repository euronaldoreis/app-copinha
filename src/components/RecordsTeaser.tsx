import Link from "next/link";
import type { RecordItem } from "./RecordsBoard";
import { Avatar } from "./Avatar";
import { ChevronIcon, RecycleIcon, TrophyIcon } from "./icons";

/**
 * Chamada para o mural de recordes: metade lenda (com o primeiro recorde à
 * mostra), metade vexame (censurado, para dar vontade de abrir).
 */
export function RecordsTeaser({ items }: { items: RecordItem[] }) {
  const lendas = items.filter((i) => i.kind === "lenda");
  const vexames = items.filter((i) => i.kind === "vexame");
  const top = lendas[0];
  const face =
    top &&
    (top.layout.type === "single"
      ? top.layout.person
      : top.layout.type === "versus"
        ? top.layout.left
        : top.layout.type === "list"
          ? top.layout.people[0]?.person
          : undefined);

  return (
    <Link
      href="/ranking?aba=recordes"
      className="rec-teaser"
      aria-label="Abrir o hall da fama e do vexame"
    >
      <span className="rec-teaser-head">
        <span className="font-pixel text-[19px] uppercase leading-tight">
          <span className="text-accent">Hall da fama</span> e{" "}
          <span className="text-[#ff9d8f]">do vexame</span>
        </span>
        <ChevronIcon width={20} height={20} className="shrink-0 text-accent" />
      </span>
      <span className="grid grid-cols-2 gap-2.5">
        <span className="rec-teaser-half rec-teaser-lenda">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
            <TrophyIcon width={14} height={14} />
            {lendas.length} {lendas.length === 1 ? "lenda" : "lendas"}
          </span>
          {face && (
            <span className="flex items-center gap-2">
              <Avatar
                name={face.name}
                photoUrl={face.photoUrl}
                avatar={face.avatar}
                size={36}
              />
              <span className="min-w-0">
                <span className="block truncate font-black leading-tight">
                  {face.name}
                </span>
                <span className="block truncate text-[12px] font-bold opacity-80">
                  {top.title}
                </span>
              </span>
            </span>
          )}
        </span>
        <span className="rec-teaser-half rec-teaser-vexame">
          <span className="relative z-10 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
            <RecycleIcon width={14} height={14} />
            {vexames.length} {vexames.length === 1 ? "vexame" : "vexames"}
          </span>
          <span className="rec-teaser-tape">Censurado · Censurado</span>
          <span className="relative z-10 font-pixel text-[17px] uppercase leading-tight">
            Quem foi?
          </span>
        </span>
      </span>
    </Link>
  );
}

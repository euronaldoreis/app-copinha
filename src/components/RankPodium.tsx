import Link from "next/link";
import type { AvatarLook } from "@/lib/sprite";
import { Avatar } from "./Avatar";
import { CrownIcon, MedalIcon } from "./icons";

export interface PodiumEntry {
  playerId: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  /** Valor por extenso: "3 títulos". */
  value: string;
}

const STEPS = {
  1: { block: "rank-gold", height: 104, avatar: 72, medal: "text-accent" },
  2: { block: "rank-silver", height: 76, avatar: 56, medal: "text-[#c9cde4]" },
  3: { block: "rank-bronze", height: 58, avatar: 56, medal: "text-[#d99058]" },
} as const;

function Step({
  place,
  entry,
}: {
  place: 1 | 2 | 3;
  entry: PodiumEntry | undefined;
}) {
  const step = STEPS[place];
  return (
    <li className="flex min-w-0 max-w-[132px] flex-1 flex-col items-center">
      {/* Sem ninguém nesse lugar o espaço fica reservado, para o pódio não desmontar. */}
      <div
        className={`flex w-full flex-col items-center gap-1.5 pb-2 ${entry ? "" : "invisible"}`}
        aria-hidden={entry ? undefined : true}
      >
        {place === 1 ? (
          <CrownIcon width={30} height={30} className={step.medal} />
        ) : (
          <MedalIcon width={24} height={24} className={step.medal} />
        )}
        <Link
          href={entry ? `/jogadores/${entry.playerId}` : "#"}
          className="flex w-full flex-col items-center gap-1.5"
          tabIndex={entry ? undefined : -1}
        >
          <Avatar
            name={entry?.name ?? "-"}
            photoUrl={entry?.photoUrl}
            avatar={entry?.avatar}
            size={step.avatar}
          />
          <span className="block w-full truncate text-center text-name font-semibold">
            {entry?.name ?? "-"}
          </span>
        </Link>
        <span className="block w-full truncate text-center text-body uppercase text-muted">
          {entry?.value ?? "-"}
        </span>
      </div>
      <div
        className={`rank-step ${step.block}`}
        style={{ height: step.height }}
        aria-label={`${place}º lugar`}
      >
        {String(place).padStart(2, "0")}
      </div>
    </li>
  );
}

/**
 * Pódio dos três primeiros: 2º à esquerda, 1º no meio (mais alto) e 3º à
 * direita. Posições sem ninguém ficam vazias.
 */
export function RankPodium({ top }: { top: PodiumEntry[] }) {
  return (
    <ol className="mb-8 flex items-end justify-center gap-2" aria-label="Pódio">
      <Step place={2} entry={top[1]} />
      <Step place={1} entry={top[0]} />
      <Step place={3} entry={top[2]} />
    </ol>
  );
}

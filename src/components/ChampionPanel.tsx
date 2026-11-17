import { Avatar } from "@/components/Avatar";
import { TrophyIcon } from "@/components/icons";

type Person = {
  player: { name: string; photoUrl?: string | null; avatar?: unknown };
  team?: { name: string } | null;
};

/**
 * Painel do campeão com o vice ao lado. Só usa elementos inline (span), então
 * pode ficar dentro de um link.
 */
export function ChampionPanel({
  champion,
  vice,
}: {
  champion: Person;
  vice?: Person | null;
}) {
  return (
    <span className="flex items-center gap-3 rounded-[10px] border-2 border-[#f5c542] bg-gradient-to-b from-[#9a6bf0] to-[#5b34b3] p-2.5">
      <Avatar
        name={champion.player.name}
        photoUrl={champion.player.photoUrl}
        avatar={champion.player.avatar as never}
        size={52}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-accent">
          <TrophyIcon width={14} height={14} />
          Campeão
        </span>
        <span className="text-title block truncate !text-[20px]">
          {champion.player.name}
        </span>
        {champion.team && (
          <span className="block truncate text-body text-muted">
            {champion.team.name}
          </span>
        )}
      </span>
      {vice && (
        <span className="flex w-16 shrink-0 flex-col items-center gap-1">
          <Avatar
            name={vice.player.name}
            photoUrl={vice.player.photoUrl}
            avatar={vice.player.avatar as never}
            size={36}
          />
          <span className="w-full truncate text-center text-[11px] font-black uppercase tracking-wider text-muted">
            Vice
          </span>
          <span className="-mt-1 w-full truncate text-center text-body font-black">
            {vice.player.name}
          </span>
        </span>
      )}
    </span>
  );
}

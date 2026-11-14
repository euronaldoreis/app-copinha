import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PlusIcon } from "@/components/icons";
import { Empty, PageTitle } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { FORMAT_LABELS, STATUS_LABELS, formatDate, plural } from "@/lib/labels";
import { allEditionViews } from "@/lib/services";
import type { Format } from "@/lib/tournament";

export const metadata: Metadata = { title: "Edições" };

export default async function EditionsPage() {
  const [data, admin] = await Promise.all([getData(), isAdmin()]);
  const views = allEditionViews(data);

  return (
    <>
      <PageTitle
        title="Edições"
        subtitle={
          views.length
            ? `${plural(views.length, "Copinha", "Copinhas")} no histórico`
            : undefined
        }
      />

      {views.length === 0 ? (
        <Empty>
          Nenhuma edição registrada ainda.
          {admin
            ? " Use o botão + para criar a primeira."
            : " Quem organiza precisa entrar para criar a primeira."}
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {views.map(({ edition, entries }) => {
            const champion = entries.find((e) => e.result === "campeao");
            const vice = entries.find((e) => e.result === "vice");
            const open = edition.status !== "encerrada";
            return (
              <Link
                key={edition.id}
                href={`/edicoes/${edition.id}`}
                className="card flex min-h-24 items-center gap-3.5 px-5 py-4"
              >
                {champion ? (
                  <Avatar
                    name={champion.player.name}
                    photoUrl={champion.player.photoUrl}
              avatar={champion.player.avatar}
                    size={52}
                  />
                ) : (
                  <span className="flex size-[52px] shrink-0 items-center justify-center border-2 border-night bg-night font-pixel text-[13px] text-accent">
                    {edition.number}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-name font-semibold">
                      {edition.name}
                    </span>
                    {open && (
                      <span
                        className="blink size-2 shrink-0 bg-accent"
                        title={STATUS_LABELS[edition.status]}
                      />
                    )}
                  </span>
                  <span className="block truncate text-body text-ink">
                    {champion
                      ? [
                          `${champion.player.name} campeão`,
                          champion.team && `com ${champion.team.name}`,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : open
                        ? STATUS_LABELS[edition.status]
                        : "Campeão não informado"}
                    {vice && (
                      <span className="text-muted">
                        {" "}
                        · vice {vice.player.name}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-body text-muted">
                    {[
                      edition.game,
                      formatDate(edition.playedOn),
                      FORMAT_LABELS[edition.format as Format],
                      plural(entries.length, "participante", "participantes"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {admin && (
        <Link
          href="/edicoes/nova"
          aria-label="Nova edição"
          title="Nova edição"
          className="btn btn-primary fixed bottom-24 right-5 z-40 size-14 p-0 sm:right-[max(1.25rem,calc(50%-24rem+1.5rem))]"
        >
          <PlusIcon width={24} height={24} />
        </Link>
      )}
    </>
  );
}

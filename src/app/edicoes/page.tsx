import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ChampionPanel } from "@/components/ChampionPanel";
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
        <div className="flex flex-col gap-4">
          {views.map(({ edition, entries, matches }, index) => {
            const champion = entries.find((e) => e.result === "campeao");
            const vice = entries.find((e) => e.result === "vice");
            const open = edition.status !== "encerrada";
            const played = matches.filter((m) => m.homeScore != null).length;
            const progress = matches.length
              ? Math.round((played / matches.length) * 100)
              : 0;
            const meta = [
              formatDate(edition.playedOn),
              edition.game,
              FORMAT_LABELS[edition.format as Format],
              plural(entries.length, "participante", "participantes"),
            ].filter(Boolean);
            return (
              <Link
                key={edition.id}
                href={`/edicoes/${edition.id}`}
                style={{ "--i": Math.min(index, 10) } as CSSProperties}
                className="anim-pop card flex flex-col gap-3 p-3.5"
              >
                {/* Título: número da edição e nome. */}
                <span className="flex items-center gap-2.5">
                  <span className="num flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-[#ffe9a3] bg-gradient-to-b from-[#ffd95e] to-[#f7a81d] px-1.5 font-pixel text-[20px] text-[#5b3600]">
                    {edition.number}
                  </span>
                  <span className="min-w-0 flex-1 text-name font-black leading-tight">
                    {edition.name}
                  </span>
                </span>

                {/* Destaque: o campeão com o vice ao lado, ou o andamento do torneio. */}
                {champion ? (
                  <ChampionPanel champion={champion} vice={vice} />
                ) : (
                  <span className="flex flex-col gap-1.5 rounded-[10px] bg-night/40 p-2.5">
                    {matches.length > 0 ? (
                      <>
                        <span className="flex justify-between text-body text-muted">
                          <span>{open ? "Progresso" : "Jogos"}</span>
                          <span className="num">
                            {played} de {matches.length}
                          </span>
                        </span>
                        <span
                          className="meter"
                          role="img"
                          aria-label={`${played} de ${matches.length} jogos disputados`}
                        >
                          <span style={{ width: `${progress}%` }} />
                        </span>
                      </>
                    ) : (
                      <span className="text-body text-muted">
                        {open
                          ? "Os jogos ainda não começaram."
                          : "Campeão não informado."}
                      </span>
                    )}
                  </span>
                )}

                {/* Situação e detalhes em etiquetas, que quebram de linha em telas estreitas. */}
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="tag">
                    {open && (
                      <span className="blink size-2 rounded-full bg-[#5bd94f]" />
                    )}
                    {STATUS_LABELS[edition.status]}
                  </span>
                  {meta.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-night/50 px-2.5 py-1 text-[12px] font-black text-muted"
                    >
                      {m}
                    </span>
                  ))}
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
          className="btn btn-primary fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-40 size-14 p-0 sm:right-[max(1.25rem,calc(50%-24rem+1.5rem))]"
        >
          <PlusIcon width={24} height={24} />
        </Link>
      )}
    </>
  );
}

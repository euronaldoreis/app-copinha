import type { Metadata } from "next";
import { createPlayerAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PlayersList } from "@/components/PlayersList";
import { Empty, PageTitle, Section } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { plural } from "@/lib/labels";
import { computeRanking } from "@/lib/stats";

export const metadata: Metadata = { title: "Jogadores" };

export default async function PlayersPage() {
  const [data, admin] = await Promise.all([getData(), isAdmin()]);
  const players = computeRanking(data).sort((a, b) =>
    a.player.name.localeCompare(b.player.name, "pt-BR"),
  );

  return (
    <>
      <PageTitle
        title="Jogadores"
        subtitle={
          players.length ? plural(players.length, "cadastrado", "cadastrados") : undefined
        }
      />

      {players.length === 0 ? (
        <Empty>
          Ninguém cadastrado ainda. Os jogadores também podem ser criados direto
          ao montar uma edição.
        </Empty>
      ) : (
        <PlayersList
          players={players.map((r) => ({
            id: r.player.id,
            name: r.player.name,
            photoUrl: r.player.photoUrl,
            avatar: r.player.avatar,
            titles: r.titles,
            detail: r.participations
              ? [
                  plural(r.participations, "participação", "participações"),
                  r.pct != null ? `${r.pct}% de aproveitamento` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Ainda não participou",
          }))}
        />
      )}

      {admin && (
        <Section title="Novo jogador">
          <ActionForm
            action={createPlayerAction}
            className="card flex flex-wrap items-end gap-3 p-5"
          >
            <label className="min-w-40 flex-1">
              <span className="label">Nome</span>
              <input name="name" className="field" required maxLength={40} />
            </label>
            <label className="min-w-40 flex-[2]">
              <span className="label">Link da foto (opcional)</span>
              <input
                name="photoUrl"
                type="url"
                className="field"
                placeholder="https://..."
              />
            </label>
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        </Section>
      )}
    </>
  );
}

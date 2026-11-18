import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { playerLogoutAction } from "@/app/actions";
import { ProfileEditor } from "@/components/ProfileEditor";
import { PageTitle } from "@/components/ui";
import { currentPlayerId, isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { computeRanking } from "@/lib/stats";
import { tierOf } from "@/lib/tier";

export const metadata: Metadata = {
  title: "Editar perfil",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function EditPlayerPage(
  props: PageProps<"/jogadores/[id]/editar">,
) {
  const { id } = await props.params;
  const playerId = Number(id);
  const [data, admin, myId] = await Promise.all([
    getData(),
    isAdmin(),
    currentPlayerId(),
  ]);
  const player = data.players.find((p) => p.id === playerId);
  if (!player) notFound();
  const isMe = myId === player.id;

  if (!admin && !isMe) {
    return (
      <>
        <PageTitle title="Editar perfil" />
        <div className="card flex max-w-lg flex-col items-start gap-4 px-6 py-5">
          <p className="text-body text-muted">
            Só o próprio jogador, pelo link de acesso que o organizador envia,
            ou o organizador podem editar este perfil.
          </p>
          <Link href={`/jogadores/${player.id}`} className="btn">
            Voltar ao perfil
          </Link>
        </div>
      </>
    );
  }

  const stats = computeRanking(data).find((r) => r.player.id === player.id);
  const tier = tierOf(stats?.bestResult ?? null, stats?.titles ?? 0);

  return (
    <>
      <PageTitle
        title={isMe && !admin ? "Meu visual" : "Editar jogador"}
        subtitle="Monte o boneco ou use uma foto. A carta mostra como vai ficar."
      />
      <ProfileEditor
        playerId={player.id}
        name={player.name}
        photoUrl={player.photoUrl}
        avatar={player.avatar}
        tier={tier}
        canRename={admin}
      />
      {isMe && !admin && (
        <form action={playerLogoutAction} className="mt-6">
          <button type="submit" className="btn btn-quiet">
            Sair deste aparelho
          </button>
        </form>
      )}
    </>
  );
}

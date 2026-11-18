import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { currentPlayerId } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/** Entrada do link de acesso: com sessão, vai direto para a tela de edição. */
export default async function MyProfilePage(props: PageProps<"/meu-perfil">) {
  const [playerId, search] = await Promise.all([
    currentPlayerId(),
    props.searchParams,
  ]);
  if (playerId != null) redirect(`/jogadores/${playerId}/editar`);

  return (
    <>
      <PageTitle
        title="Meu perfil"
        subtitle="Cada jogador edita o próprio perfil pelo link que o organizador envia."
      />
      <p className="card max-w-lg px-6 py-5 text-body text-muted">
        {search.link === "invalido"
          ? "Esse link não vale mais. Peça um novo ao organizador."
          : "Abra o seu link de acesso para editar o seu perfil. Se ainda não recebeu, peça ao organizador."}
      </p>
    </>
  );
}

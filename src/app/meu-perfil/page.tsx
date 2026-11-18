import type { Metadata } from "next";
import Link from "next/link";
import { playerLogoutAction, updateMyProfileAction } from "@/app/actions";
import { AvatarEditor } from "@/components/AvatarEditor";
import { PhotoField } from "@/components/PhotoField";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageTitle } from "@/components/ui";
import { currentPlayerId } from "@/lib/auth";
import { getData } from "@/lib/data";
import { isUploadedPhoto } from "@/lib/photo";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function MyProfilePage(props: PageProps<"/meu-perfil">) {
  const [playerId, search] = await Promise.all([
    currentPlayerId(),
    props.searchParams,
  ]);
  const player =
    playerId == null
      ? undefined
      : (await getData()).players.find((p) => p.id === playerId);

  if (!player) {
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

  return (
    <>
      <PageTitle
        title={player.name}
        subtitle="Aqui você troca a sua foto e o seu avatar."
      />
      <ActionForm
        key={`${player.photoUrl}|${JSON.stringify(player.avatar)}`}
        action={updateMyProfileAction}
        className="card flex flex-col gap-3 p-4"
      >
        <AvatarEditor
          name={player.name}
          photoUrl={player.photoUrl}
          initial={player.avatar}
        />
        <PhotoField currentUrl={player.photoUrl} />
        <label>
          <span className="label">Ou um link de foto</span>
          <input
            name="photoUrl"
            type="url"
            className="field"
            defaultValue={
              isUploadedPhoto(player.photoUrl) ? "" : (player.photoUrl ?? "")
            }
            placeholder="https://..."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton className="btn btn-primary">Salvar</SubmitButton>
          <Link href={`/jogadores/${player.id}`} className="btn">
            Ver meu perfil
          </Link>
        </div>
      </ActionForm>
      <form action={playerLogoutAction} className="mt-4">
        <button type="submit" className="btn btn-quiet">
          Sair deste aparelho
        </button>
      </form>
    </>
  );
}

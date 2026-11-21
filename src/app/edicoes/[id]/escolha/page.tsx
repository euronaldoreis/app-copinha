import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronIcon } from "@/components/icons";
import { TeamChoiceAdmin } from "@/components/TeamChoiceAdmin";
import { Empty, PageTitle } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { loadChoice } from "./load";

export const metadata: Metadata = { title: "Escolha dos times" };

/**
 * Escolha dos times (só admin, no celular): cada jogador cita 2 times, depois
 * cada um bane 1. O que sobra vira a lista do sorteio. A TV acompanha em /tv.
 */
export default async function TeamChoicePage(
  props: PageProps<"/edicoes/[id]/escolha">,
) {
  const [{ id }, admin] = await Promise.all([props.params, isAdmin()]);
  if (!admin) redirect("/admin");
  const loaded = await loadChoice(id);
  if (!loaded) notFound();
  const { edition, previousName, players, choices, knownTeams } = loaded;

  const problem = !edition.useTeams
    ? "Esta edição é só com os jogadores, sem times."
    : edition.status !== "inscricoes"
      ? "A tabela já foi gerada: a escolha dos times só acontece antes."
      : players.length < 2
        ? "Adicione pelo menos 2 participantes para começar."
        : null;

  return (
    <>
      <PageTitle title="Escolha dos times" subtitle={edition.name} />
      <Link
        href={`/edicoes/${edition.id}`}
        className="btn btn-quiet -mt-4 mb-6 px-0"
      >
        <ChevronIcon className="rotate-180" />
        Voltar para a edição
      </Link>
      {problem ? (
        <Empty>{problem}</Empty>
      ) : (
        <TeamChoiceAdmin
          editionId={edition.id}
          previousName={previousName}
          players={players}
          choices={choices}
          knownTeams={knownTeams}
        />
      )}
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamChoiceTv } from "@/components/TeamChoiceTv";
import { loadChoice } from "../load";

export const metadata: Metadata = { title: "Escolha dos times · TV" };

/** Escolha dos times para projetar na TV. Só mostra; não precisa de login. */
export default async function TeamChoiceTvPage(
  props: PageProps<"/edicoes/[id]/escolha/tv">,
) {
  const { id } = await props.params;
  const loaded = await loadChoice(id);
  if (!loaded) notFound();
  return (
    <TeamChoiceTv
      editionId={loaded.edition.id}
      editionName={loaded.edition.name}
      players={loaded.players}
      choices={loaded.choices}
    />
  );
}

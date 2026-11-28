import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { idOf, rivalryHref, sortedPlayers } from "./load";
import { Picker } from "./Picker";

export const metadata: Metadata = { title: "Confronto" };

/** Escolha do par. Com os dois escolhidos, vai para o endereço do confronto. */
export default async function RivalryPickerPage(props: PageProps<"/confronto">) {
  const params = await props.searchParams;
  const a = idOf(params.a);
  const b = idOf(params.b);
  const players = await sortedPlayers();
  const valid = (id: number | null) => id != null && players.some((p) => p.id === id);
  if (valid(a) && valid(b) && a !== b) redirect(rivalryHref(a!, b!));
  return (
    <>
      <PageTitle title="Confronto" subtitle="O retrospecto entre dois jogadores" />
      <Picker players={players} a={valid(a) ? a : null} b={valid(b) ? b : null} />
      {a != null && a === b && (
        <p className="mt-3 text-body text-muted">Escolha dois jogadores diferentes.</p>
      )}
    </>
  );
}

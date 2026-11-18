import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewEditionForm } from "@/components/NewEditionForm";
import { PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { listPlayers, nextEditionNumber, sortEditions } from "@/lib/services";

export const metadata: Metadata = { title: "Nova edição" };

export default async function NewEditionPage() {
  if (!(await isAdmin())) redirect("/admin");
  const db = getDb();
  const [players, nextNumber, data] = await Promise.all([
    listPlayers(db),
    nextEditionNumber(db),
    getData(),
  ]);
  // Jogos já usados, do mais recente para o mais antigo, como sugestão.
  const games = [...new Set(sortEditions(data.editions).map((e) => e.game))];
  // Quem mais participou aparece primeiro (conta todas as inscrições, inclusive
  // de edições que ainda não começaram); empate fica em ordem alfabética.
  const participations = new Map<number, number>();
  for (const e of data.entries)
    participations.set(e.playerId, (participations.get(e.playerId) ?? 0) + 1);
  const ordered = [...players].sort(
    (a, b) =>
      (participations.get(b.id) ?? 0) - (participations.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  return (
    <>
      <PageTitle
        title="Nova edição"
        subtitle="Dá para ajustar participantes, times e formato depois, até gerar a tabela."
      />
      <NewEditionForm players={ordered} nextNumber={nextNumber} games={games} />
    </>
  );
}

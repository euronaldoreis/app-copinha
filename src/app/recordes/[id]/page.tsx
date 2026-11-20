import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordCard } from "@/components/RecordsBoard";
import { PageTitle } from "@/components/ui";
import { getData } from "@/lib/data";
import { recordItems } from "@/lib/recordItems";
import { computeRecords } from "@/lib/stats";

// Página de um recorde só: é o link que vai no "Exaltar/Zoar no grupo", com a
// prévia (opengraph-image) mostrando o cartão.

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  return recordItems(computeRecords(await getData())).find((r) => r.id === id) ?? null;
}

export async function generateMetadata(props: PageProps<"/recordes/[id]">): Promise<Metadata> {
  const item = await load(props.params);
  if (!item) return { title: "Recordes" };
  const title = `${item.kind === "vexame" ? "Vexame" : "Lenda"}: ${item.title}`;
  return {
    title,
    description: item.share,
    openGraph: { title, description: item.share },
  };
}

export default async function RecordPage(props: PageProps<"/recordes/[id]">) {
  const item = await load(props.params);
  if (!item) notFound();
  return (
    <>
      <PageTitle title="Recordes" subtitle={item.kind === "vexame" ? "Vexame da Copinha" : "Lenda da Copinha"} />
      <div className="mx-auto max-w-xl">
        <RecordCard item={item} index={0} />
        <Link href="/ranking?aba=recordes" className="btn btn-quiet mt-6 w-full justify-center">
          Ver todos os recordes e vexames
        </Link>
      </div>
    </>
  );
}

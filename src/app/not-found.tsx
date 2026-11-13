import Link from "next/link";
import { PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageTitle
        title="Página não encontrada"
        subtitle="Essa aí foi eliminada na fase de grupos."
      />
      <Link href="/" className="btn">
        Voltar para o início
      </Link>
    </>
  );
}

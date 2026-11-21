import { getDb } from "@/db";
import { getTeamBadge } from "@/lib/services";

// Escudo de um time, guardado no banco. A URL leva ?v=<versão>, então pode
// ficar no cache para sempre: ao trocar o escudo, a URL muda.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const badge = /^\d+$/.test(id) ? await getTeamBadge(getDb(), Number(id)) : null;
  // Sem escudo (ou link quebrado): a tela volta para o escudo padrão. O cache
  // curto evita tentar baixar de novo um link quebrado a cada visita.
  if (!badge)
    return new Response("Escudo não encontrado", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=600" },
    });
  return new Response(Buffer.from(badge.data, "base64"), {
    headers: {
      "Content-Type": badge.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

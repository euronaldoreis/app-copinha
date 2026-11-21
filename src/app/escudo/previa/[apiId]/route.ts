import { apiLogoUrl, downloadBadge } from "@/lib/apiFootball";
import { isAdmin } from "@/lib/auth";

// Prévia das opções da busca de escudos (Admin -> Times): a imagem vem pelo
// nosso servidor, porque o servidor de imagens da API não serve bem direto
// para o navegador. Só para o admin e só imagens de times da API.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ apiId: string }> },
) {
  if (!(await isAdmin())) return new Response("Sem acesso", { status: 403 });
  const { apiId } = await params;
  if (!/^\d{1,9}$/.test(apiId)) return new Response("Escudo não encontrado", { status: 404 });
  try {
    const image = await downloadBadge(apiLogoUrl(Number(apiId)));
    return new Response(Buffer.from(image.data, "base64"), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Escudo não encontrado", { status: 404 });
  }
}

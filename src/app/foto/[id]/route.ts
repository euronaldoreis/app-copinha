import { getDb } from "@/db";
import { getPlayerPhoto } from "@/lib/services";

// Foto enviada de um jogador. A URL leva ?v=<versão>, então pode ficar no
// cache do navegador para sempre: ao trocar a foto, a URL muda.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const photo = /^\d+$/.test(id) ? await getPlayerPhoto(getDb(), Number(id)) : null;
  if (!photo) return new Response("Foto não encontrada", { status: 404 });
  return new Response(Buffer.from(photo.data, "base64"), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

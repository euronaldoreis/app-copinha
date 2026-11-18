// Link de acesso do jogador: confere o código, abre a sessão e leva ao perfil.
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { startPlayerSession } from "@/lib/auth";
import { findPlayerByAccessToken } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const player = await findPlayerByAccessToken(getDb(), token);
  const ok =
    player?.accessHash != null &&
    (await startPlayerSession(player.id, player.accessHash));
  const res = NextResponse.redirect(
    new URL(ok ? "/meu-perfil" : "/meu-perfil?link=invalido", request.url),
  );
  // O código não deve vazar para outros sites pelo cabeçalho Referer.
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

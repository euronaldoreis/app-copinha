// Peças comuns das imagens de prévia de link (opengraph-image): fonte,
// brasão, contorno do texto e o rosto do jogador.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AvatarLook } from "@/lib/sprite";
import { getDb } from "@/db";
import { isUploadedPhoto } from "@/lib/photo";
import { portraitSvg } from "@/lib/portrait";
import { getPlayerPhoto } from "@/lib/services";

export const OG_SIZE = { width: 1200, height: 630 };

export const ogFont = readFile(
  join(process.cwd(), "node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff"),
);
export const ogBrasao = readFile(join(process.cwd(), "public/brasao.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

export const NIGHT = "#0a1a52";
export const ROYAL = "#1c47ad";
export const OUTLINE = (w: number) =>
  [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]]
    .map(([x, y]) => `${x}px ${y}px 0 ${NIGHT}`)
    .join(", ");

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export interface OgPerson {
  id: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
}

/** Foto do jogador como data URI; sem foto (ou se não der para baixar), o retrato desenhado. */
export async function photoOf(p: OgPerson): Promise<string> {
  const fallback = svgUri(portraitSvg(p.name, p.avatar));
  if (!p.photoUrl) return fallback;
  try {
    if (isUploadedPhoto(p.photoUrl)) {
      const photo = await getPlayerPhoto(getDb(), p.id);
      return photo && /png|jpe?g/.test(photo.contentType) ? `data:${photo.contentType};base64,${photo.data}` : fallback;
    }
    if (!/^https?:\/\//.test(p.photoUrl)) return fallback;
    const res = await fetch(p.photoUrl, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/png|jpe?g/.test(type)) return fallback;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return fallback;
  }
}

export function Face({ src, size, dim = false }: { src: string; size: number; dim?: boolean }) {
  return (
    <div style={{ display: "flex", padding: 6, borderRadius: size * 0.26, background: "rgba(10,26,82,0.85)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem dentro do ImageResponse */}
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        style={{ borderRadius: size * 0.22, border: `4px solid ${NIGHT}`, objectFit: "cover", opacity: dim ? 0.85 : 1 }}
      />
    </div>
  );
}

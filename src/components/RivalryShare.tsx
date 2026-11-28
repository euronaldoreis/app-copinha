"use client";

import { useState } from "react";

/**
 * Imagem de prévia que o Next pôs na página (og:image), buscada no próprio
 * site aberto (o endereço da meta tag pode apontar para outro domínio).
 */
function ogImageUrl() {
  const content = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
  if (!content) return null;
  const url = new URL(content, window.location.href);
  return `${url.pathname}${url.search}`;
}

/**
 * Compartilhar o confronto: no celular, o menu do sistema com a imagem do card
 * (quando dá para mandar arquivo) ou só o link; sem esse menu, o WhatsApp com
 * o texto e o link, que mostra a prévia.
 */
export function RivalryShare({ text, fileName }: { text: string; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = window.location.href;
    if (!navigator.share) {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
      return;
    }
    setBusy(true);
    try {
      let files: File[] | undefined;
      const img = ogImageUrl();
      if (img && navigator.canShare) {
        try {
          const res = await fetch(img);
          const blob = await res.blob();
          const file = new File([blob], `${fileName}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) files = [file];
        } catch {
          // sem a imagem, vai só o link (que já mostra a prévia)
        }
      }
      await navigator.share(files ? { files, text: `${text} ${url}` } : { text, url });
    } catch {
      // a pessoa fechou o menu: nada a fazer
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} className="rivalry-share">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
      {busy ? "Preparando..." : "Compartilhar confronto"}
    </button>
  );
}

"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

const DARK = "#0a1a52";
const LIGHT = "#ffffff";

/**
 * QR code do link de acesso do jogador: ele aponta a câmera do celular para a
 * tela do organizador e o link abre direto. Também dá para baixar a imagem.
 */
export function AccessQrCode({ link, playerName }: { link: string; playerName: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const opts = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: DARK, light: LIGHT } };
    Promise.all([
      QRCode.toString(link, { ...opts, type: "svg" }),
      QRCode.toDataURL(link, { ...opts, width: 720 }),
    ])
      .then(([s, p]) => {
        if (!alive) return;
        setSvg(s);
        setPng(p);
      })
      .catch(() => {
        if (alive) setSvg(null);
      });
    return () => {
      alive = false;
    };
  }, [link]);

  if (!svg) return null;
  const file = `acesso-${playerName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;

  return (
    <figure className="access-qr">
      <div
        className="access-qr-code"
        role="img"
        aria-label={`QR code do link de acesso de ${playerName}`}
        // SVG gerado aqui mesmo pela biblioteca a partir do link.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="text-body text-muted">
        {playerName} aponta a câmera do celular para o código e o link abre direto.
      </figcaption>
      {png && (
        <a className="btn" href={png} download={file}>
          Baixar QR code
        </a>
      )}
    </figure>
  );
}

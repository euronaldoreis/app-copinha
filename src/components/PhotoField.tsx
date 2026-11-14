"use client";

import { useState } from "react";

/** Reduz a foto para um quadrado de `size` pixels (recorte central) em JPEG. */
async function toSquareJpeg(file: File, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Escolher uma foto do aparelho para o jogador. Dentro de um formulário, leva
 * os campos "photoData" (foto nova, já reduzida) e "removePhoto" (= "1" para
 * tirar a foto atual).
 */
export function PhotoField({ currentUrl }: { currentUrl: string | null }) {
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = data || (removed ? null : currentUrl);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      return;
    }
    setBusy(true);
    try {
      setData(await toSquareJpeg(file));
      setRemoved(false);
    } catch {
      setError("Não consegui abrir essa imagem. Tente um JPG ou PNG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="photoData" value={data} />
      <input type="hidden" name="removePhoto" value={removed && !data ? "1" : ""} />
      <span className="label">Foto</span>
      <div className="flex items-center gap-4">
        <span className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden border-2 border-night bg-night text-center text-body text-faint">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local ou foto do próprio site
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            "Sem foto"
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn cursor-pointer">
            {busy ? "Abrindo..." : preview ? "Trocar foto" : "Escolher foto"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {preview && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setData("");
                setRemoved(true);
              }}
            >
              Remover
            </button>
          )}
        </div>
      </div>
      {data && (
        <p className="text-body text-muted">
          Foto nova escolhida. Ela só vale depois de salvar.
        </p>
      )}
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

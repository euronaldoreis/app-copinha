"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { saveProfileAction } from "@/app/actions";
import { isUploadedPhoto } from "@/lib/photo";
import {
  HAIR,
  HAIR_STYLES,
  SHIRT,
  SKIN,
  autoLook,
  type AvatarLook,
} from "@/lib/sprite";
import { Avatar } from "./Avatar";
import { toSquareJpeg } from "./PhotoField";
import { CheckIcon, ShuffleIcon } from "./icons";

type Mode = "avatar" | "foto";
type Part = keyof AvatarLook;

/** Partes do boneco, com as opções de cada uma (cor de amostra, se houver). */
const PARTS: { id: Part; label: string; swatches: (string | null)[] }[] = [
  { id: "skin", label: "Pele", swatches: SKIN },
  { id: "hair", label: "Cabelo", swatches: HAIR },
  { id: "style", label: "Corte", swatches: Array(HAIR_STYLES).fill(null) },
  { id: "shirt", label: "Camisa", swatches: SHIRT.map(([hex]) => hex) },
];
const STYLE_NAMES = ["Curto", "Comprido", "Careca", "Topete"];
const BALD = 2;

const random = (n: number) => Math.floor(Math.random() * n);

/**
 * Tela de edição do visual do jogador: a carta mostra o resultado ao vivo e
 * a pessoa escolhe entre o boneco (avatar) e uma foto. O organizador também
 * troca o nome; o próprio jogador, não.
 */
export function ProfileEditor({
  playerId,
  name: initialName,
  photoUrl,
  avatar,
  tier,
  canRename,
}: {
  playerId: number;
  name: string;
  photoUrl: string | null;
  avatar: AvatarLook | null;
  tier: string;
  canRename: boolean;
}) {
  const [state, formAction, saving] = useActionState(saveProfileAction, null);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<Mode>(photoUrl ? "foto" : "avatar");
  const [part, setPart] = useState<Part>("skin");
  const [custom, setCustom] = useState<AvatarLook | null>(avatar);

  // Foto: a enviada agora (data), a que já existe (se não foi removida) ou um link.
  const uploaded = isUploadedPhoto(photoUrl) ? photoUrl : null;
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [link, setLink] = useState(uploaded ? "" : (photoUrl ?? ""));
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = custom ?? autoLook(name || initialName);
  const linkOk = /^https:\/\/\S+$/.test(link.trim());
  const photo =
    data || (linkOk ? link.trim() : null) || (removed ? null : uploaded);
  const shown = mode === "foto" ? photo : null;

  const pick = (p: Part, value: number) => setCustom({ ...look, [p]: value });
  const shuffle = () =>
    setCustom({
      skin: random(SKIN.length),
      hair: random(HAIR.length),
      style: random(HAIR_STYLES),
      shirt: random(SHIRT.length),
    });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Escolha um arquivo de imagem.");
      return;
    }
    setBusy(true);
    try {
      setData(await toSquareJpeg(file));
      setRemoved(false);
      setLink("");
    } catch {
      setPhotoError("Não consegui abrir essa imagem. Tente um JPG ou PNG.");
    } finally {
      setBusy(false);
    }
  }

  function removePhoto() {
    setData("");
    setLink("");
    setRemoved(true);
  }

  const current = PARTS.find((p) => p.id === part)!;

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-20">
      {/* O que vai para o servidor. No modo avatar, a foto é tirada. */}
      <input type="hidden" name="playerId" value={playerId} />
      <input
        type="hidden"
        name="avatar"
        value={custom ? JSON.stringify(custom) : ""}
      />
      <input
        type="hidden"
        name="photoData"
        value={mode === "foto" ? data : ""}
      />
      <input
        type="hidden"
        name="photoUrl"
        value={mode === "foto" ? link : ""}
      />
      <input
        type="hidden"
        name="removePhoto"
        value={mode === "avatar" || (removed && !data) ? "1" : ""}
      />
      {canRename && <input type="hidden" name="name" value={name} />}

      {/* Palco: a carta com a prévia e a escolha entre boneco e foto. */}
      <section className="arena-stage card flex flex-col items-center gap-4 px-4 pb-5 pt-6">
        <div className={`player-card profile-card tier-${tier} w-[168px]`}>
          <span className="profile-card-photo">
            <Avatar
              name={name || initialName}
              photoUrl={shown}
              avatar={custom}
              size={136}
            />
          </span>
          <span className="player-plate w-full">
            <span className="text-title w-full truncate text-center !text-[18px]">
              {name || initialName}
            </span>
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="O que aparece na carta"
          className="grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-[14px] border-2 border-[#4d7fe0] bg-night p-1"
        >
          {(
            [
              ["avatar", "Boneco"],
              ["foto", "Foto"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={`min-h-11 rounded-[10px] font-pixel text-[17px] uppercase transition-colors ${
                mode === id
                  ? "bg-gradient-to-b from-[#ffd95e] to-[#f7a81d] text-[#5b3600] shadow-[inset_0_-3px_0_#d98a0c]"
                  : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "foto" && !photo && (
          <p className="text-center text-body text-muted">
            Sem foto, a carta mostra o boneco.
          </p>
        )}
      </section>

      {mode === "avatar" ? (
        <section className="card flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="heading !m-0">Monte o boneco</h2>
            <span className="text-body text-muted">
              {custom ? "Escolhido por você" : "Automático"}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Parte do boneco"
            className="grid grid-cols-4 gap-2"
          >
            {PARTS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={part === p.id}
                onClick={() => setPart(p.id)}
                className="chip justify-center !px-1 !text-[15px]"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            className="grid grid-cols-4 gap-3 sm:grid-cols-5"
          >
            {current.swatches.map((hex, i) => {
              const active = look[part] === i;
              const variant = { ...look, [part]: i };
              const label =
                part === "style" ? STYLE_NAMES[i] : `${current.label} ${i + 1}`;
              return (
                <OptionTile
                  key={i}
                  active={active}
                  label={label}
                  onClick={() => pick(part, i)}
                  badge={
                    hex && (
                      <span
                        className="absolute -bottom-1.5 -right-1.5 size-5 rounded-full border-2 border-night"
                        style={{ background: hex }}
                      />
                    )
                  }
                >
                  <Avatar name={initialName} avatar={variant} size={60} tier={false} />
                </OptionTile>
              );
            })}
          </div>
          {part === "hair" && look.style === BALD && (
            <p className="text-body text-muted">
              Com o corte careca a cor do cabelo não aparece.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={shuffle}>
              <ShuffleIcon width={20} height={20} />
              Sortear
            </button>
            {custom && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setCustom(null)}
              >
                Voltar ao automático
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="card flex flex-col gap-4 p-4">
          <h2 className="heading !m-0">Sua foto</h2>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-4 text-center ${
              photo
                ? "border-[#4d7fe0] bg-night/40"
                : "min-h-[160px] border-faint bg-night/60"
            }`}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local ou foto do próprio site
              <img
                src={photo}
                alt="Prévia da foto"
                className="size-[160px] rounded-[22%] border-2 border-night object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                <span className="font-pixel text-[20px] uppercase">
                  {busy ? "Abrindo..." : "Escolher foto"}
                </span>
                <span className="text-body text-muted">
                  Da galeria ou da câmera. A foto é cortada em quadrado.
                </span>
              </>
            )}
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
            {photo && (
              <span className="btn mt-1">
                {busy ? "Abrindo..." : "Trocar foto"}
              </span>
            )}
          </label>
          {photo && (
            <button
              type="button"
              className="btn btn-danger self-start"
              onClick={removePhoto}
            >
              Remover foto
            </button>
          )}
          {data && (
            <p className="text-body text-muted">
              Foto nova escolhida. Ela só vale depois de salvar.
            </p>
          )}
          {photoError && (
            <p role="alert" className="text-body text-danger">
              {photoError}
            </p>
          )}
          <details className="group">
            <summary className="cursor-pointer list-none text-body font-black text-muted [&::-webkit-details-marker]:hidden">
              Prefere usar um link de foto?
            </summary>
            <input
              type="url"
              className="field mt-2"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (e.target.value) setData("");
              }}
              placeholder="https://..."
              aria-label="Link da foto"
            />
          </details>
        </section>
      )}

      {canRename && (
        <section className="card p-4">
          <label>
            <span className="label">Nome</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
            />
          </label>
          <p className="mt-2 text-body text-muted">
            Só o organizador troca o nome, porque ele aparece no histórico.
          </p>
        </section>
      )}

      {state?.error && (
        <p role="alert" className="card px-4 py-3 text-body text-danger">
          {state.error}
        </p>
      )}

      {/* Barra de salvar, fixa logo acima do menu de baixo. */}
      <div className="save-bar">
        <div className="mx-auto flex w-full max-w-3xl gap-3 px-4">
          <Link
            href={`/jogadores/${playerId}`}
            className="btn flex-1 justify-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn btn-primary flex-[2] justify-center"
            disabled={saving || busy}
          >
            <CheckIcon width={20} height={20} />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function OptionTile({
  active,
  label,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative flex aspect-square items-center justify-center rounded-[16px] border-[3px] p-1 transition-transform active:scale-95 ${
        active
          ? "border-accent bg-[#ffd95e]/25 shadow-[0_0_0_2px_#0a1a52,0_0_14px_rgb(255_200_61_/_0.6)]"
          : "border-[#4d7fe0] bg-night/50"
      }`}
    >
      {children}
      {badge}
      {active && (
        <span className="absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border-2 border-night bg-accent text-night">
          <CheckIcon width={14} height={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

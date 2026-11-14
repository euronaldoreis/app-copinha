"use client";

import { useState } from "react";
import {
  HAIR,
  HAIR_STYLES,
  SHIRT,
  SKIN,
  autoLook,
  type AvatarLook,
} from "@/lib/sprite";
import { Avatar } from "./Avatar";

const FIELDS = {
  skin: "Pele",
  hair: "Cabelo",
  style: "Corte",
  shirt: "Camisa",
} as const;

/**
 * Escolha da aparência do avatar em pixel art. Entra num formulário: o campo
 * "avatar" leva a escolha em JSON (vazio = automático, sorteado do nome).
 */
export function AvatarEditor({
  name,
  photoUrl,
  initial,
}: {
  name: string;
  photoUrl: string | null;
  initial: AvatarLook | null;
}) {
  const [custom, setCustom] = useState<AvatarLook | null>(initial);
  // Mostrado (e editado a partir de): a escolha ou a aparência automática.
  const look = custom ?? autoLook(name);

  const pick = (field: keyof AvatarLook, value: number) =>
    setCustom({ ...look, [field]: value });

  const swatch = (
    field: keyof AvatarLook,
    index: number,
    content: React.ReactNode,
    label: string,
  ) => {
    const active = custom != null && look[field] === index;
    return (
      <button
        key={index}
        type="button"
        aria-pressed={active}
        aria-label={`${FIELDS[field]}: ${label}`}
        title={label}
        onClick={() => pick(field, index)}
        className={`flex size-11 items-center justify-center border-2 ${
          active ? "border-accent bg-night" : "border-faint"
        }`}
      >
        {content}
      </button>
    );
  };

  const color = (hex: string) => (
    <span className="block size-6 border-2 border-night" style={{ background: hex }} />
  );

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="avatar" value={custom ? JSON.stringify(custom) : ""} />

      <div className="flex items-center gap-4">
        <Avatar name={name} avatar={custom} size={88} />
        <div className="min-w-0">
          <p className="text-name font-semibold">Avatar</p>
          <p className="text-body text-muted">
            {custom ? "Aparência escolhida" : "Automático, a partir do nome"}
          </p>
          {custom && (
            <button
              type="button"
              className="btn btn-quiet mt-1 min-h-0 !px-0"
              onClick={() => setCustom(null)}
            >
              Voltar ao automático
            </button>
          )}
        </div>
      </div>

      {photoUrl && (
        <p className="text-body text-muted">
          Este jogador tem uma foto cadastrada, e ela aparece no lugar do avatar.
          Apague o link da foto abaixo para mostrar o avatar.
        </p>
      )}

      <div>
        <span className="label">{FIELDS.skin}</span>
        <div className="flex flex-wrap gap-2">
          {SKIN.map((hex, i) => swatch("skin", i, color(hex), `tom ${i + 1}`))}
        </div>
      </div>
      <div>
        <span className="label">{FIELDS.hair}</span>
        <div className="flex flex-wrap gap-2">
          {HAIR.map((hex, i) => swatch("hair", i, color(hex), `cor ${i + 1}`))}
        </div>
      </div>
      <div>
        <span className="label">{FIELDS.style}</span>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: HAIR_STYLES }, (_, i) =>
            swatch(
              "style",
              i,
              <Avatar name={name} avatar={{ ...look, style: i }} size={32} />,
              `corte ${i + 1}`,
            ),
          )}
        </div>
      </div>
      <div>
        <span className="label">{FIELDS.shirt}</span>
        <div className="flex flex-wrap gap-2">
          {SHIRT.map(([hex], i) => swatch("shirt", i, color(hex), `cor ${i + 1}`))}
        </div>
      </div>
    </div>
  );
}

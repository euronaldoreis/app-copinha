// Texto na fonte de 8x8 com os acentos desenhados em pixels por cima das
// letras (ver src/lib/arcade.ts). Use em tudo que vai na fonte dos títulos.
import type { CSSProperties } from "react";
import { ACCENT_PIXELS, splitArcade, type Accent } from "@/lib/arcade";

/** Um pixel da fonte: a célula de cada letra tem 8. */
const PX = 0.125;

// Cada traço do acento vira um retângulo de fundo, na cor do texto.
const MARK_STYLE = Object.fromEntries(
  Object.entries(ACCENT_PIXELS).map(([accent, strokes]) => [
    accent,
    {
      backgroundImage: strokes
        .map(() => "linear-gradient(currentColor, currentColor)")
        .join(", "),
      backgroundPosition: strokes
        .map(([x, y]) => `${x * PX}em ${y * PX}em`)
        .join(", "),
      backgroundSize: strokes.map(([, , w]) => `${w * PX}em ${PX}em`).join(", "),
    },
  ]),
) as Record<Accent, CSSProperties>;

export function Arcade({ children }: { children: string }) {
  const chars = splitArcade(children);
  if (!chars.some((c) => c.accent)) return chars.map((c) => c.base).join("");

  // Junta as letras sem acento em trechos de texto comum.
  const parts: (string | { base: string; accent: Accent })[] = [];
  for (const c of chars) {
    const last = parts.at(-1);
    if (c.accent) parts.push({ base: c.base, accent: c.accent });
    else if (typeof last === "string") parts[parts.length - 1] = last + c.base;
    else parts.push(c.base);
  }

  return (
    <>
      <span aria-hidden="true">
        {parts.map((part, i) =>
          typeof part === "string" ? (
            part
          ) : (
            <span key={i} className="acc">
              {part.base}
              <span className="acc-mark" style={MARK_STYLE[part.accent]} />
            </span>
          ),
        )}
      </span>
      {/* Para leitores de tela e para copiar: a palavra com o acento de verdade. */}
      <span className="sr-only">{children}</span>
    </>
  );
}

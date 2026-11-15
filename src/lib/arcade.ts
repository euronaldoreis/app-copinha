// Acentos na fonte de 8x8 dos títulos. A fonte espreme as maiúsculas
// acentuadas para o acento caber na célula (o "Í" fica irreconhecível), então
// a letra vai sem acento, inteira, e o acento é desenhado por cima em pixels:
// "EDIÇÕES" sai como E, D, I, Ç, O + til, E, S. O cedilha da fonte é bom e fica.

export type Accent = "acute" | "grave" | "circumflex" | "tilde" | "diaeresis";

/** Marca combinante (depois de separar letra e acento) -> acento desenhado. */
const MARKS: Record<string, Accent> = {
  "́": "acute",
  "̀": "grave",
  "̂": "circumflex",
  "̃": "tilde",
  "̈": "diaeresis",
};
const CEDILLA = "̧";
const COMBINING = /[̀-ͯ]/;

/**
 * Desenho de cada acento numa grade de 7x2 pixels (a largura de uma letra):
 * lista de traços [coluna, linha, largura].
 */
export const ACCENT_PIXELS: Record<Accent, [number, number, number][]> = {
  acute: [
    [4, 0, 2],
    [3, 1, 2],
  ],
  grave: [
    [1, 0, 2],
    [2, 1, 2],
  ],
  circumflex: [
    [3, 0, 1],
    [2, 1, 1],
    [4, 1, 1],
  ],
  tilde: [
    [1, 0, 2],
    [5, 0, 1],
    [0, 1, 1],
    [3, 1, 2],
  ],
  diaeresis: [
    [1, 1, 2],
    [4, 1, 2],
  ],
};

/** Quantos pixels de fonte o acento fica acima do topo da letra (1 de folga). */
export const ACCENT_RISE = 3;

export interface ArcadeChar {
  /** A letra como vai na fonte: sem acento (o "ç" continua "ç"). */
  base: string;
  accent: Accent | null;
}

/** Separa o texto em letras e seus acentos. */
export function splitArcade(text: string): ArcadeChar[] {
  const out: ArcadeChar[] = [];
  for (const ch of text.normalize("NFD")) {
    const last = out.at(-1);
    if (!COMBINING.test(ch)) out.push({ base: ch, accent: null });
    else if (!last) continue;
    else if (ch === CEDILLA) last.base = (last.base + ch).normalize("NFC");
    else if (MARKS[ch] && !last.accent) last.accent = MARKS[ch];
    // Outras marcas (raras em português) não têm desenho: a letra vai sem.
  }
  return out;
}

/** O texto só com as letras, sem os acentos desenhados à parte. */
export function arcadeBase(text: string) {
  return splitArcade(text)
    .map((c) => c.base)
    .join("");
}

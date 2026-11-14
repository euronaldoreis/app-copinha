// Aparência dos bonecos em pixel art. Sai das letras do nome, então o mesmo
// jogador tem sempre a mesma cara no retrato e no boneco que entra em campo.

export const SKIN = ["#f6c9a0", "#e2a877", "#b97a4e", "#8a5632"];
export const HAIR = ["#1d1a1a", "#4a2c17", "#8c5a2b", "#d8a531", "#b9b9c4"];
/** [camisa, gola e calção]. Nenhuma verde: sumiria no gramado do sorteio. */
export const SHIRT = [
  ["#e23b2e", "#ffffff"],
  ["#2f6fe0", "#ffffff"],
  ["#ffd42a", "#1a2670"],
  ["#c2185b", "#ffffff"],
  ["#f6f6fa", "#1a2670"],
  ["#111122", "#e23b2e"],
  ["#f08a1c", "#111122"],
  ["#7a3fd1", "#ffd42a"],
  ["#19b5c9", "#111122"],
];

/** Cortes de cabelo, na mesma ordem em todos os desenhos. */
export const HAIR_STYLES = 4;

/** Número bem espalhado a partir do nome (FNV-1a com uma mistura final). */
function nameHash(text: string) {
  let h = 2166136261;
  for (const ch of text.toLocaleLowerCase("pt-BR")) {
    h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Escolhas de aparência de um jogador: índice de cada traço nas listas acima
 * (pele, cor do cabelo, corte e camisa).
 */
export interface AvatarLook {
  skin: number;
  hair: number;
  style: number;
  shirt: number;
}

const inRange = (n: unknown, size: number) =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n < size;

/** Aceita só uma aparência completa e dentro dos limites; senão, null. */
export function parseAvatar(value: unknown): AvatarLook | null {
  if (value == null || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    inRange(v.skin, SKIN.length) &&
    inRange(v.hair, HAIR.length) &&
    inRange(v.style, HAIR_STYLES) &&
    inRange(v.shirt, SHIRT.length)
  ) {
    return {
      skin: v.skin as number,
      hair: v.hair as number,
      style: v.style as number,
      shirt: v.shirt as number,
    };
  }
  return null;
}

/** Aparência automática, sorteada a partir do nome (a de quem não escolheu). */
export function autoLook(name: string): AvatarLook {
  const h = nameHash(name);
  return {
    skin: h % SKIN.length,
    hair: (h >>> 8) % HAIR.length,
    style: (h >>> 24) % HAIR_STYLES,
    shirt: (h >>> 16) % SHIRT.length,
  };
}

export interface SpriteLook {
  /** Cor de cada letra dos desenhos: H cabelo, S pele, E olho, M boca, J camisa, C gola, P calção, K meião, B chuteira. */
  colors: Record<string, string>;
  /** Índice do corte de cabelo (0 a HAIR_STYLES - 1). */
  style: number;
}

/** Desenho do jogador: o que ele escolheu ou, sem escolha, o automático do nome. */
export function spriteLook(
  name: string,
  custom?: AvatarLook | null,
): SpriteLook {
  // Cada traço usa um pedaço diferente do número, para não andarem juntos.
  const look = parseAvatar(custom) ?? autoLook(name);
  const [shirt, trim] = SHIRT[look.shirt];
  return {
    colors: {
      H: HAIR[look.hair],
      S: SKIN[look.skin],
      E: "#111122",
      M: "#7a2f2f",
      J: shirt,
      C: trim,
      P: trim,
      K: shirt,
      B: "#111122",
    },
    style: look.style,
  };
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/** Converte linhas de desenho em retângulos, juntando pixels vizinhos da mesma cor. */
export function pixelRects(
  rows: string[],
  colors: Record<string, string>,
  offsetY = 0,
): PixelRect[] {
  const rects: PixelRect[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let end = x;
      while (row[end] === ch) end++;
      if (colors[ch]) rects.push({ x, y: y + offsetY, w: end - x, fill: colors[ch] });
      x = end;
    }
  });
  return rects;
}


/** Símbolo de reciclagem (três setas em triângulo), 15x14. Usado no caminhão, no cabeçalho e nos títulos. */
export const RECYCLE_PIXELS = [
  ".....##........",
  "...####........",
  "..#####..##....",
  "...####..###...",
  "...###....##...",
  "..###.....###..",
  ".###.......####",
  ".###......#####",
  "...........####",
  "............###",
  "....##........#",
  "..#########....",
  ".##########....",
  "...###.........",
];

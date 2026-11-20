// Retrato de desenho dos jogadores sem foto (o mesmo do <Avatar>), também em
// texto SVG para as imagens geradas no servidor (prévia de link).
import { spriteLook, type AvatarLook } from "./sprite";

/** Cabelo de cada corte (mesma ordem de HAIR_STYLES): curto, comprido, careca e topete. */
export const HAIR_PATHS = [
  "M14.5 19C13 6 35 6 33.5 19 30 13.5 18 13.5 14.5 19Z",
  "M14 31C9 5 39 5 34 31l-2.5-1C35 14 13 14 16.5 30Z",
  "",
  "M14.5 19C12 9 22 3 35 8c-3 2-.5 6-1.5 11C30 14 18 14 14.5 19Z",
];
/** Fundo do retrato, um por corte, para a lista não ficar toda da mesma cor. */
export const PORTRAIT_BG = ["#ffd9a8", "#c8f0c0", "#e6d0ff", "#a9d6ff"];

/** O retrato como texto SVG (48x48). */
export function portraitSvg(name: string, avatar?: AvatarLook | null): string {
  const look = spriteLook(name, avatar);
  const { S: skin, H: hair, J: shirt } = look.colors;
  const line = 'stroke="#0a1a52" stroke-linejoin="round"';
  const hairPath = HAIR_PATHS[look.style];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="96" height="96">`,
    `<rect width="48" height="48" fill="${PORTRAIT_BG[look.style]}"/>`,
    `<path d="M11.5 49C11.5 39 16 35 24 35s12.5 4 12.5 14Z" fill="${shirt}" stroke-width="2.5" ${line}/>`,
    `<rect x="20.5" y="28" width="7" height="8.5" fill="${skin}" stroke-width="2.5" ${line}/>`,
    `<ellipse cx="24" cy="20" rx="9.5" ry="10.5" fill="${skin}" stroke-width="2.5" ${line}/>`,
    hairPath ? `<path d="${hairPath}" fill="${hair}" stroke-width="2.5" ${line}/>` : "",
    `<circle cx="20.3" cy="21" r="1.5" fill="#0a1a52"/>`,
    `<circle cx="27.7" cy="21" r="1.5" fill="#0a1a52"/>`,
    `<path d="M20.5 25.5Q24 28.5 27.5 25.5" fill="none" stroke="#0a1a52" stroke-width="2" stroke-linecap="round"/>`,
    `</svg>`,
  ].join("");
}

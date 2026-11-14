// Fotos enviadas pelo admin ficam guardadas no banco (tabela player_photos) e
// são servidas em /foto/<id>. O players.photoUrl de quem tem foto enviada
// aponta para esse caminho.

/** Caminho (com versão, para o navegador trocar o cache) da foto enviada. */
export const photoPath = (playerId: number) =>
  `/foto/${playerId}?v=${Date.now()}`;

/** A foto do jogador é uma das enviadas, e não um link externo? */
export const isUploadedPhoto = (url: string | null | undefined) =>
  typeof url === "string" && url.startsWith("/foto/");

/** Tamanho máximo, em bytes, da foto já reduzida. */
export const PHOTO_MAX_BYTES = 300_000;

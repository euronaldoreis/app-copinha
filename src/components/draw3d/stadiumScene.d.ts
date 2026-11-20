import type { GroupDrawItem } from "@/lib/services";

export type DrawPhase = "name" | "group" | "show";

/** O que o placar mostra a cada instante do sorteio. */
export interface BoardState {
  placed: number;
  total: number;
  phase: DrawPhase;
  tick: number;
  done: boolean;
  /** Nome na roleta (fase "name") ou o sorteado. */
  name: string;
  team: string;
  letter: string;
  /** O sorteado da vez é o campeão da edição anterior. */
  champion: boolean;
}

/** Etapas da festa do título, na ordem. */
export type PartyStage = "third" | "vice" | "drumroll" | "champion" | "party";

/** Um participante da cena: no sorteio vem de GroupDrawItem; na festa, com o lugar no pódio. */
export type SceneItem = GroupDrawItem & { place?: 1 | 2 | 3 };

export interface DrawSceneOptions {
  /** "draw" = sorteio dos grupos (padrão); "party" = festa do título no pódio. */
  mode?: "draw" | "party";
  /** Elemento que recebe o canvas (ocupa a tela inteira). */
  container: HTMLElement;
  /** Camada onde ficam as etiquetas com o nome dos jogadores. */
  tagsLayer: HTMLElement;
  items: SceneItem[];
  reducedMotion: boolean;
  /** Espaço ocupado pelo placar (em cima) e pelos botões (embaixo), em px. */
  insets: () => { top: number; bottom: number };
  /** Sorteio: o que o placar mostra. */
  onBoard?: (state: BoardState) => void;
  /** Festa: etapa que começou. */
  onStage?: (stage: PartyStage) => void;
  /** Abertura (caminhão chegando) começou/terminou; `fading` = letreiro some antes do fim. */
  onIntro: (active: boolean, fading?: boolean) => void;
  /** Sorteio terminou / a festa começou. */
  onDone: () => void;
}

export interface DrawScene {
  /** Pula a abertura e o sorteio: todos aparecem no lugar. */
  skip: () => void;
  /** Recomeça do início: abertura e sorteio de novo. */
  replay: () => void;
  dispose: () => void;
}

export function createDrawScene(options: DrawSceneOptions): DrawScene;

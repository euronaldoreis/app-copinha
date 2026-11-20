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

export interface DrawSceneOptions {
  /** Elemento que recebe o canvas (ocupa a tela inteira). */
  container: HTMLElement;
  /** Camada onde ficam as etiquetas com o nome dos jogadores. */
  tagsLayer: HTMLElement;
  items: GroupDrawItem[];
  reducedMotion: boolean;
  /** Espaço ocupado pelo placar (em cima) e pelos botões (embaixo), em px. */
  insets: () => { top: number; bottom: number };
  onBoard: (state: BoardState) => void;
  /** Abertura (caminhão chegando) começou/terminou; `fading` = letreiro some antes do fim. */
  onIntro: (active: boolean, fading?: boolean) => void;
  onDone: () => void;
}

export interface DrawScene {
  /** Pula a abertura e o sorteio: todos aparecem no lugar. */
  skip: () => void;
  dispose: () => void;
}

export function createDrawScene(options: DrawSceneOptions): DrawScene;

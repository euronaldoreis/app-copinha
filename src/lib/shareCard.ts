// Imagem do pódio para compartilhar (WhatsApp etc.), desenhada num <canvas>
// com os mesmos bonecos e a taça que estão na tela da festa.

export interface CardPerson {
  name: string;
  team: string | null;
  /** O <svg> do boneco que está na tela. */
  sprite: SVGSVGElement | null;
}

export interface CardData {
  editionName: string;
  champion: CardPerson;
  vice: CardPerson | null;
  third: CardPerson | null;
  trophy: SVGSVGElement | null;
}

const W = 1080;
const H = 1350;
const NIGHT = "#04051a";
const CANVAS_BG = "#0b0e2e";
const ACCENT = "#ffd42a";
const INK = "#f6f6fa";
const MUTED = "#a9acd0";
const PITCH = "#1c9440";

/** Copia um <svg> da tela para uma imagem que o canvas consegue desenhar. */
function svgImage(svg: SVGSVGElement, color?: string): Promise<HTMLImageElement | null> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.removeAttribute("class");
  // Fora da página o CSS não vale: tira o segundo quadro das pernas e fixa a cor.
  copy.querySelectorAll(".legs-b").forEach((g) => g.remove());
  if (color) copy.setAttribute("fill", color);
  const box = svg.viewBox.baseVal;
  // Desenha grande para os pixels continuarem retos ao ampliar.
  copy.setAttribute("width", String(box.width * 20));
  copy.setAttribute("height", String(box.height * 20));
  const url =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(new XMLSerializer().serializeToString(copy));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Encolhe a letra até o texto caber na largura. */
function fitText(
  g: CanvasRenderingContext2D,
  text: string,
  family: string,
  size: number,
  maxWidth: number,
) {
  let px = size;
  g.font = `${px}px ${family}`;
  while (px > 14 && g.measureText(text).width > maxWidth) {
    px -= 2;
    g.font = `${px}px ${family}`;
  }
}

async function fontFamily(variable: string): Promise<string> {
  const name = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  if (!name) return "monospace";
  try {
    await document.fonts.load(`32px ${name}`);
  } catch {
    // segue com a fonte reserva
  }
  return `${name}, monospace`;
}

export async function buildShareCard(data: CardData): Promise<File | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = false;

  const [pixel, body] = await Promise.all([
    fontFamily("--font-display"),
    fontFamily("--font-bold"),
  ]);
  const people = [data.vice, data.champion, data.third];
  const [sprites, trophy] = await Promise.all([
    Promise.all(people.map((p) => (p?.sprite ? svgImage(p.sprite) : null))),
    data.trophy ? svgImage(data.trophy, ACCENT) : null,
  ]);

  // Fundo e moldura.
  g.fillStyle = CANVAS_BG;
  g.fillRect(0, 0, W, H);
  g.fillStyle = NIGHT;
  g.fillRect(0, 0, W, 16);
  g.fillRect(0, H - 16, W, 16);
  g.fillRect(0, 0, 16, H);
  g.fillRect(W - 16, 0, 16, H);

  // Placar.
  g.fillStyle = NIGHT;
  g.fillRect(60, 60, W - 120, 400);
  g.strokeStyle = "#4a4f9c";
  g.lineWidth = 8;
  g.strokeRect(64, 64, W - 128, 392);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = INK;
  fitText(g, data.editionName.toUpperCase(), pixel, 30, W - 220);
  g.fillText(data.editionName.toUpperCase(), W / 2, 140);
  g.fillStyle = ACCENT;
  fitText(g, "CAMPEÃO!", pixel, 34, W - 220);
  g.fillText("CAMPEÃO!", W / 2, 262);
  fitText(g, data.champion.name.toUpperCase(), pixel, 64, W - 220);
  g.fillText(data.champion.name.toUpperCase(), W / 2, 342);
  if (data.champion.team) {
    g.fillStyle = MUTED;
    fitText(g, data.champion.team, body, 44, W - 220);
    g.fillText(data.champion.team, W / 2, 412);
  }

  // Gramado listrado.
  const top = 500;
  const bottom = H - 150;
  g.fillStyle = PITCH;
  g.fillRect(60, top, W - 120, bottom - top);
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let x = 60; x < W - 60; x += 160) g.fillRect(x, top, 80, bottom - top);
  g.strokeStyle = NIGHT;
  g.lineWidth = 8;
  g.strokeRect(60, top, W - 120, bottom - top);

  // Pódio: vice à esquerda, campeão no meio, terceiro à direita.
  const blockW = 280;
  const gap = 20;
  const base = bottom - 110;
  const heights = [150, 210, 100];
  const fills = [INK, ACCENT, INK];
  const labels = ["2", "1", "3"];
  people.forEach((person, i) => {
    if (!person) return;
    const x = W / 2 + (i - 1) * (blockW + gap) - blockW / 2;
    const y = base - heights[i];
    g.fillStyle = NIGHT;
    g.fillRect(x, y, blockW, heights[i]);
    g.fillStyle = fills[i];
    g.fillRect(x + 8, y + 8, blockW - 16, heights[i] - 16);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(x + blockW - 24, y + 8, 16, heights[i] - 16);
    g.fillRect(x + 8, y + heights[i] - 24, blockW - 16, 16);
    g.fillStyle = NIGHT;
    g.font = `36px ${pixel}`;
    g.fillText(labels[i], x + blockW / 2, y + 48);

    // Boneco em cima do degrau (o campeão é maior e segura a taça).
    const spriteW = i === 1 ? 192 : 144;
    const spriteH = (spriteW * 16) / 12;
    const img = sprites[i];
    if (img) g.drawImage(img, x + blockW / 2 - spriteW / 2, y - spriteH, spriteW, spriteH);
    if (i === 1 && trophy) {
      g.drawImage(trophy, x + blockW / 2 - 60, y - spriteH - 120, 120, 120);
    }

    // Nome embaixo, com sombra como no site.
    const name = person.name;
    fitText(g, name, body, 52, blockW);
    g.fillStyle = "rgba(0,0,0,0.65)";
    g.fillText(name, x + blockW / 2 + 4, base + 56 + 4);
    g.fillStyle = INK;
    g.fillText(name, x + blockW / 2, base + 56);
  });

  // Rodapé com o endereço do site.
  g.fillStyle = MUTED;
  g.font = `22px ${pixel}`;
  g.fillText(location.host.toUpperCase(), W / 2, H - 82);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return null;
  return new File([blob], "copinha-podio.png", { type: "image/png" });
}

/**
 * Abre o compartilhamento do celular com a imagem; onde isso não existe
 * (computador), baixa o arquivo.
 */
export async function shareCard(file: File, text: string) {
  const payload = { files: [file], text };
  if (navigator.canShare?.(payload)) {
    try {
      await navigator.share(payload);
    } catch {
      // a pessoa fechou a janela de compartilhar: nada a fazer
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

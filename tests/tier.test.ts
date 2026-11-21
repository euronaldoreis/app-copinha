import { describe, expect, it } from "vitest";
import { cardHighlight, EMERALD_TITLES, SUPER_TITLES, TIER_LABELS, tierOf } from "@/lib/tier";

describe("categoria da carta do jogador", () => {
  it("segue a melhor campanha", () => {
    expect(tierOf("campeao", 1)).toBe("campeao");
    expect(tierOf("vice")).toBe("vice");
    expect(tierOf("terceiro")).toBe("podio");
    expect(tierOf("semifinal")).toBe("participou");
    expect(tierOf("quartas")).toBe("participou");
    expect(tierOf(null)).toBe("participou");
  });

  it("vira esmeralda de 5 a 9 títulos, ainda com a legenda Campeão", () => {
    expect(EMERALD_TITLES).toBe(5);
    expect(tierOf("campeao", 4)).toBe("campeao");
    expect(tierOf("campeao", 5)).toBe("esmeralda");
    expect(tierOf("campeao", 9)).toBe("esmeralda");
    expect(TIER_LABELS.esmeralda).toBe("Campeão");
  });

  it("vira rubi (super campeão) a partir de 10 títulos", () => {
    expect(SUPER_TITLES).toBe(10);
    expect(tierOf("campeao", 10)).toBe("rubi");
    expect(tierOf("campeao", 14)).toBe("rubi");
    expect(TIER_LABELS.rubi).toBe("Super campeão");
  });
});

describe("verso da carta", () => {
  const base = { titles: 0, finals: 0, podiums: 0, participations: 3 };

  it("destaca a categoria e as copinhas ganhas", () => {
    expect(cardHighlight("esmeralda", { ...base, titles: 5 })).toEqual({
      title: "Jogador Esmeralda",
      name: "Esmeralda",
      count: 5,
      text: "copinhas ganhas",
    });
    expect(cardHighlight("campeao", { ...base, titles: 1 }).text).toBe("copinha ganha");
    expect(cardHighlight("rubi", { ...base, titles: 12 }).title).toBe("Jogador Rubi");
  });

  it("sem títulos, mostra finais, pódios ou participações", () => {
    expect(cardHighlight("vice", { ...base, finals: 2 })).toMatchObject({ count: 2, text: "finais disputadas" });
    expect(cardHighlight("podio", { ...base, podiums: 1 })).toMatchObject({ count: 1, text: "pódio" });
    expect(cardHighlight("participou", base)).toMatchObject({ title: "Jogador Lixo", count: 3 });
    expect(cardHighlight("participou", { ...base, participations: 0 }).title).toBe("Jogador Estreante");
  });
});

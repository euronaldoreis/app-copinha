import { describe, expect, it } from "vitest";
import { HAIR, HAIR_STYLES, SHIRT, SKIN, autoLook, parseAvatar, spriteLook } from "@/lib/sprite";

describe("avatar em pixel art", () => {
  it("a aparência automática é sempre a mesma para o mesmo nome", () => {
    expect(autoLook("Ítalo")).toEqual(autoLook("ítalo"));
    const look = autoLook("Caio");
    expect(look.skin).toBeLessThan(SKIN.length);
    expect(look.hair).toBeLessThan(HAIR.length);
    expect(look.style).toBeLessThan(HAIR_STYLES);
    expect(look.shirt).toBeLessThan(SHIRT.length);
  });

  it("a escolha vale no lugar da automática", () => {
    const chosen = { skin: 3, hair: 4, style: 2, shirt: 7 };
    const look = spriteLook("Caio", chosen);
    expect(look.colors.S).toBe(SKIN[3]);
    expect(look.colors.H).toBe(HAIR[4]);
    expect(look.colors.J).toBe(SHIRT[7][0]);
    expect(look.style).toBe(2);
    // sem escolha (ou escolha inválida), volta ao automático
    expect(spriteLook("Caio", null)).toEqual(spriteLook("Caio"));
    expect(spriteLook("Caio", { skin: 99 } as never)).toEqual(spriteLook("Caio"));
  });

  it("parseAvatar só aceita aparência completa e dentro dos limites", () => {
    expect(parseAvatar({ skin: 0, hair: 0, style: 0, shirt: 0 })).not.toBeNull();
    expect(parseAvatar({ skin: 4, hair: 0, style: 0, shirt: 0 })).toBeNull();
    expect(parseAvatar({ skin: 1.5, hair: 0, style: 0, shirt: 0 })).toBeNull();
    expect(parseAvatar({ skin: "1", hair: 0, style: 0, shirt: 0 })).toBeNull();
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar("x")).toBeNull();
  });
});

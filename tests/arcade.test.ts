import { describe, expect, it } from "vitest";
import { arcadeBase, splitArcade } from "@/lib/arcade";

describe("acentos na fonte de 8x8", () => {
  it("separa a letra do acento, que é desenhado à parte", () => {
    expect(splitArcade("Ítalo")[0]).toEqual({ base: "I", accent: "acute" });
    expect(splitArcade("João").map((c) => c.accent)).toEqual([
      null,
      null,
      "tilde",
      null,
    ]);
    expect(splitArcade("Você")[3]).toEqual({ base: "e", accent: "circumflex" });
    expect(splitArcade("à")[0].accent).toBe("grave");
    expect(splitArcade("Müller")[1].accent).toBe("diaeresis");
  });

  it("mantém o cedilha na própria letra", () => {
    expect(arcadeBase("Edições")).toBe("Ediçoes");
    expect(splitArcade("Edições").map((c) => c.accent)).toEqual([
      null,
      null,
      null,
      null,
      "tilde",
      null,
      null,
    ]);
  });

  it("não mexe em texto sem acento e ignora marcas sem desenho", () => {
    expect(arcadeBase("Copinha dos Lixos #1")).toBe("Copinha dos Lixos #1");
    expect(splitArcade("Ångström").map((c) => c.base).join("")).toBe("Angstrom");
    expect(splitArcade("Å")[0].accent).toBeNull();
  });
});

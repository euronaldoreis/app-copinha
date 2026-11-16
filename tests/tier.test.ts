import { describe, expect, it } from "vitest";
import { tierOf } from "@/lib/tier";

describe("categoria da carta", () => {
  it("segue a melhor campanha", () => {
    expect(tierOf("campeao")).toBe("campeao");
    expect(tierOf("vice")).toBe("vice");
    expect(tierOf("terceiro")).toBe("podio");
    expect(tierOf("semifinal")).toBe("participou");
    expect(tierOf(null)).toBe("participou");
  });
});

import { describe, expect, it } from "vitest";
import { todayISO } from "@/lib/labels";

describe("data de hoje", () => {
  it("usa o fuso de Manaus (UTC-4)", () => {
    // 02:30 UTC do dia 19 ainda é dia 18 em Manaus
    expect(todayISO(new Date("2026-11-19T02:30:00Z"))).toBe("2026-11-18");
    expect(todayISO(new Date("2026-11-19T05:00:00Z"))).toBe("2026-11-19");
  });
});

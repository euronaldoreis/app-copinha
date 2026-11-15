import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db";
import { MAX_ATTEMPTS, WINDOW_MS, clearAttempts, countAttempt } from "@/lib/loginLimit";

const dir = mkdtempSync(join(tmpdir(), "copinha-login-"));
const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("limite de tentativas de login", () => {
  it("bloqueia depois de MAX_ATTEMPTS e conta por origem", async () => {
    const t = 1_000_000;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      expect((await countAttempt(db, "1.1.1.1", t)).blocked).toBe(false);
    }
    const sixth = await countAttempt(db, "1.1.1.1", t + 60_000);
    expect(sixth.blocked).toBe(true);
    expect(sixth.retryAfterMs).toBe(WINDOW_MS - 60_000);
    // outra origem não é afetada
    expect((await countAttempt(db, "2.2.2.2", t)).blocked).toBe(false);
  });

  it("libera quando a janela acaba e quando o login dá certo", async () => {
    const t = 5_000_000;
    for (let i = 0; i <= MAX_ATTEMPTS; i++) await countAttempt(db, "3.3.3.3", t);
    expect((await countAttempt(db, "3.3.3.3", t + WINDOW_MS)).blocked).toBe(false);

    for (let i = 0; i <= MAX_ATTEMPTS; i++) await countAttempt(db, "4.4.4.4", t);
    await clearAttempts(db, "4.4.4.4");
    expect((await countAttempt(db, "4.4.4.4", t)).blocked).toBe(false);
  });

  it("uma rajada em paralelo não passa toda pela checagem", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => countAttempt(db, "5.5.5.5", 9_000_000)),
    );
    expect(results.filter((r) => !r.blocked)).toHaveLength(MAX_ATTEMPTS);
  });
});

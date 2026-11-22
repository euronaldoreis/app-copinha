import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db";
import {
  createEdition,
  createPlayer,
  editionView,
  loadAll,
  saveMatchResult,
  setKnockoutPhases,
  startEdition,
} from "@/lib/services";

const dir = mkdtempSync(join(tmpdir(), "copinha-third-"));
const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);
const view = async (id: number) => editionView(await loadAll(db), id)!;

/** Placar de cada jogo, para comparar antes e depois. */
const scores = (v: Awaited<ReturnType<typeof view>>) =>
  Object.fromEntries(
    v.matches
      .filter((m) => m.stage !== "terceiro")
      .map((m) => [
        m.id,
        [m.homeEntryId, m.awayEntryId, m.homeScore, m.awayScore],
      ]),
  );

/** Joga tudo o que estiver pronto, com o mandante vencendo. */
async function playReady(edId: number, stage?: string) {
  for (;;) {
    const ready = (await view(edId)).matches.filter(
      (m) =>
        m.homeScore == null &&
        m.homeEntryId != null &&
        m.awayEntryId != null &&
        (!stage || m.stage === stage),
    );
    if (!ready.length) return;
    for (const m of ready)
      await saveMatchResult(db, m.id, { homeScore: 2, awayScore: 1 });
  }
}

describe("disputa de 3º lugar", () => {
  let edId = 0;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    const ids: number[] = [];
    for (const n of [
      "Ana",
      "Bia",
      "Caio",
      "Davi",
      "Edu",
      "Fábio",
      "Gil",
      "Hugo",
    ])
      ids.push((await createPlayer(db, n)).id);
    const ed = await createEdition(db, {
      name: "Copa",
      number: 1,
      game: "FIFA",
      playedOn: "2026-11-22",
      useTeams: false,
      config: {
        format: "grupos",
        groupsCount: 2,
        legs: 1,
        pairing: "interno",
        crossGames: 0,
        qualifiers: 4,
        thirdPlace: true,
      },
      playerIds: ids,
    });
    await startEdition(db, ed.id);
    edId = ed.id;
    await playReady(edId);
  });
  afterAll(() => {
    db.$client.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows segura o arquivo por um instante.
    }
  });

  it("tirar só o 3º lugar mantém os placares e recalcula a colocação", async () => {
    const before = await view(edId);
    expect(before.edition.status).toBe("encerrada");
    expect(before.entries.filter((e) => e.result === "terceiro")).toHaveLength(
      1,
    );

    await setKnockoutPhases(db, edId, {
      qualifiers: 4,
      thirdPlace: false,
      playoffs: 0,
    });

    const after = await view(edId);
    expect(after.matches.some((m) => m.stage === "terceiro")).toBe(false);
    expect(scores(after)).toEqual(scores(before));
    expect(after.edition.thirdPlace).toBe(false);
    expect(after.edition.status).toBe("encerrada");
    const results = after.entries.map((e) => e.result);
    expect(results.filter((r) => r === "campeao")).toHaveLength(1);
    expect(results.filter((r) => r === "semifinal")).toHaveLength(2);
    expect(results).not.toContain("terceiro");
    expect(results).not.toContain("quarto");
  });

  it("criar só o 3º lugar também não apaga nada", async () => {
    const before = await view(edId);
    await setKnockoutPhases(db, edId, {
      qualifiers: 4,
      thirdPlace: true,
      playoffs: 0,
    });

    const after = await view(edId);
    const third = after.matches.find((m) => m.stage === "terceiro")!;
    expect(third).toBeDefined();
    // Já com os perdedores das semifinais.
    const semis = after.matches.filter(
      (m) => m.stage === "mata" && m.round === 1,
    );
    const losers = semis.map((m) =>
      m.homeScore! > m.awayScore! ? m.awayEntryId : m.homeEntryId,
    );
    expect([third.homeEntryId, third.awayEntryId].sort()).toEqual(
      losers.sort(),
    );
    expect(scores(after)).toEqual(scores(before));
    // Falta jogar a disputa: a copa volta para "em andamento".
    expect(after.edition.status).toBe("andamento");

    await playReady(edId, "terceiro");
    expect((await view(edId)).edition.status).toBe("encerrada");
  });

  it("mudar as fases do mata-mata continua refazendo o mata-mata", async () => {
    await setKnockoutPhases(db, edId, {
      qualifiers: 2,
      thirdPlace: false,
      playoffs: 0,
    });
    const v = await view(edId);
    const knockout = v.matches.filter((m) => m.stage !== "grupo");
    expect(knockout).toHaveLength(1);
    expect(knockout[0].homeScore).toBeNull();
  });
});

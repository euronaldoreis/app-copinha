import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDb } from "@/db";
import {
  addLateEntry,
  createEdition,
  createPlayer,
  editionView,
  loadAll,
  startEdition,
} from "@/lib/services";

const dir = mkdtempSync(join(tmpdir(), "copinha-order-"));
const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(() => {
  db.$client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows segura o arquivo por um instante.
  }
});

it("na rodada, os jogos alternam entre os grupos (A, B, A, B...)", async () => {
  const ids: number[] = [];
  for (const n of ["Ana", "Bia", "Caio", "Davi", "Edu", "Fábio", "Gil", "Hugo", "Ivo"])
    ids.push((await createPlayer(db, n)).id);
  const ed = await createEdition(db, {
    name: "Copa",
    number: 1,
    game: "FIFA",
    playedOn: "2026-11-21",
    useTeams: false,
    config: {
      format: "grupos",
      groupsCount: 2,
      legs: 1,
      pairing: "interno",
      crossGames: 0,
      qualifiers: 4,
      thirdPlace: false,
    },
    playerIds: ids.slice(0, 8),
  });
  await startEdition(db, ed.id);
  // Com alguém incluído depois, os jogos novos também entram na alternância.
  await addLateEntry(db, ed.id, { playerId: ids[8], groupLabel: "B" });

  const { matches } = editionView(await loadAll(db), ed.id)!;
  const group = matches.filter((m) => m.stage === "grupo");
  for (const round of new Set(group.map((m) => m.round))) {
    const labels = group.filter((m) => m.round === round).map((m) => m.groupLabel);
    // Nunca dois jogos seguidos do mesmo grupo enquanto o outro ainda tem jogo.
    const a = labels.filter((l) => l === "A").length;
    const b = labels.filter((l) => l === "B").length;
    const alternated = Array.from({ length: Math.max(a, b) }, (_, i) =>
      [i < a ? "A" : null, i < b ? "B" : null].filter(Boolean),
    ).flat();
    expect(labels).toEqual(alternated);
  }
});

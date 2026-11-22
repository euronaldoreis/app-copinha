import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDb } from "@/db";
import {
  createEdition,
  createPlayer,
  drawTeams,
  editionView,
  loadAll,
  saveMatchResult,
  setEntryTeam,
  startEdition,
} from "@/lib/services";

const dir = mkdtempSync(join(tmpdir(), "copinha-team-"));
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

it("troca o time com a edição em andamento sem mexer em mais nada", async () => {
  const ids: number[] = [];
  for (const n of ["Ana", "Bia", "Caio", "Davi", "Edu", "Fábio", "Gil", "Hugo"])
    ids.push((await createPlayer(db, n)).id);
  const ed = await createEdition(db, {
    name: "Copa",
    number: 1,
    game: "FIFA",
    playedOn: "2026-11-21",
    useTeams: true,
    teamPool: [
      "Ajax",
      "Benfica",
      "Celtic",
      "Dortmund",
      "Everton",
      "Fiorentina",
      "Getafe",
      "Hertha",
    ],
    config: {
      format: "grupos",
      groupsCount: 2,
      legs: 1,
      pairing: "interno",
      crossGames: 0,
      qualifiers: 4,
      thirdPlace: false,
    },
    playerIds: ids,
  });
  await drawTeams(db, ed.id);
  await startEdition(db, ed.id);
  const first = (await editionView(await loadAll(db), ed.id))!.matches[0];
  await saveMatchResult(db, first.id, { homeScore: 3, awayScore: 1 });

  const before = editionView(await loadAll(db), ed.id)!;
  const target = before.entries[0];
  const other = before.entries[1];

  await setEntryTeam(db, target.id, "Íbis");

  const after = editionView(await loadAll(db), ed.id)!;
  expect(after.entries.find((e) => e.id === target.id)?.team?.name).toBe(
    "Íbis",
  );
  // Jogos, placares, grupos e status iguais.
  const strip = (v: typeof before) => ({
    status: v.edition.status,
    matches: v.matches.map(
      ({
        id,
        homeEntryId,
        awayEntryId,
        homeScore,
        awayScore,
        round,
        slot,
      }) => ({
        id,
        homeEntryId,
        awayEntryId,
        homeScore,
        awayScore,
        round,
        slot,
      }),
    ),
    groups: v.entries.map((e) => [e.id, e.groupLabel, e.seed]),
  });
  expect(strip(after)).toEqual(strip(before));

  // Time de outro participante e time vazio não valem com a tabela gerada.
  await expect(setEntryTeam(db, target.id, other.team!.name)).rejects.toThrow(
    /já está com outro/,
  );
  await expect(setEntryTeam(db, target.id, "")).rejects.toThrow(
    /precisa ter um time/,
  );
});

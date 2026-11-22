import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db";
import { matches } from "@/db/schema";
import {
  UserError,
  addLateEntry,
  createEdition,
  createPlayer,
  drawTeams,
  editionView,
  loadAll,
  saveMatchResult,
  startEdition,
} from "@/lib/services";
import {
  planLateEntry,
  planMatches,
  type EntryLike,
  type FormatConfig,
  type PlannedMatch,
} from "@/lib/tournament";

const base: FormatConfig = {
  format: "grupos",
  groupsCount: 2,
  legs: 1,
  pairing: "interno",
  crossGames: 0,
  qualifiers: 4,
  thirdPlace: false,
};

/** Monta a tabela com n participantes e inclui mais um no grupo `label`. */
function scenario(config: FormatConfig, n: number, label: string) {
  const entries: EntryLike[] = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    seed: i,
    groupLabel:
      config.format === "grupos" ? "ABCD"[i % config.groupsCount] : "A",
  }));
  const existing = planMatches(config, entries).filter(
    (m) => m.stage === "grupo",
  );
  const newcomer = { id: 99, seed: n, groupLabel: label };
  const added = planLateEntry(
    config,
    [...entries, newcomer],
    existing,
    99,
    label,
  );
  return { entries, existing, added };
}

/** Ninguém joga duas vezes na mesma rodada. */
function noDoubleBooking(all: PlannedMatch[]) {
  const seen = new Set<string>();
  for (const m of all) {
    for (const id of [m.homeEntryId, m.awayEntryId]) {
      const key = `${m.round}:${id}`;
      expect(
        seen.has(key),
        `jogador ${id} duas vezes na rodada ${m.round}`,
      ).toBe(false);
      seen.add(key);
    }
  }
}

describe("jogos de quem entra no meio", () => {
  it("na liga com número ímpar, ocupa as folgas sem criar rodadas", () => {
    const { existing, added } = scenario(
      { ...base, format: "liga", qualifiers: 0 },
      5,
      "A",
    );
    expect(added).toHaveLength(5);
    const rounds = new Set(existing.map((m) => m.round));
    expect(added.every((m) => rounds.has(m.round))).toBe(true);
    noDoubleBooking([...existing, ...added]);
    const opponents = added.map((m) =>
      m.homeEntryId === 99 ? m.awayEntryId : m.homeEntryId,
    );
    expect(new Set(opponents)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("na liga com número par, abre rodadas novas no fim", () => {
    const { existing, added } = scenario(
      { ...base, format: "liga", qualifiers: 0 },
      4,
      "A",
    );
    const last = Math.max(...existing.map((m) => m.round));
    expect(added).toHaveLength(4);
    expect(added.every((m) => m.round > last)).toBe(true);
    noDoubleBooking([...existing, ...added]);
  });

  it("com ida e volta, enfrenta cada um duas vezes com mando trocado", () => {
    const { existing, added } = scenario({ ...base, legs: 2 }, 6, "A");
    expect(added).toHaveLength(6); // 3 colegas do grupo A, ida e volta
    noDoubleBooking([...existing, ...added]);
    for (const opp of [1, 3, 5]) {
      const games = added.filter(
        (m) => m.homeEntryId === opp || m.awayEntryId === opp,
      );
      expect(games).toHaveLength(2);
      expect(games[0].homeEntryId).toBe(games[1].awayEntryId);
    }
    // a volta vem depois da ida
    const ida = added.slice(0, 3).map((m) => m.round);
    const volta = added.slice(3).map((m) => m.round);
    expect(Math.min(...volta)).toBeGreaterThan(Math.max(...ida));
  });

  it("só enfrenta o próprio grupo no formato interno", () => {
    const { added } = scenario(base, 8, "B");
    expect(added.every((m) => m.groupLabel === "B")).toBe(true);
    const opponents = added.map((m) =>
      m.homeEntryId === 99 ? m.awayEntryId : m.homeEntryId,
    );
    expect(new Set(opponents)).toEqual(new Set([2, 4, 6, 8]));
  });

  it("no misto, enfrenta o próprio grupo e o grupo do par", () => {
    const { existing, added } = scenario({ ...base, pairing: "misto" }, 8, "A");
    const own = added.filter((m) => m.groupLabel === "A");
    const cross = added.filter((m) => m.groupLabel === "AxB");
    expect(own).toHaveLength(4);
    expect(cross).toHaveLength(4);
    noDoubleBooking([...existing, ...added]);
  });

  it("os números de jogo (slot) não repetem dentro da rodada", () => {
    const { existing, added } = scenario(
      { ...base, format: "liga", qualifiers: 0 },
      5,
      "A",
    );
    const keys = [...existing, ...added].map(
      (m) => `${m.groupLabel}:${m.round}:${m.slot}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("incluir participante com a edição em andamento", () => {
  const dir = mkdtempSync(join(tmpdir(), "copinha-late-"));
  const db = createDb(`file:${join(dir, "test.db").replace(/\\/g, "/")}`);
  let ids: number[] = [];

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    for (const n of [
      "Ana",
      "Bia",
      "Caio",
      "Davi",
      "Edu",
      "Fábio",
      "Gil",
      "Hugo",
      "Ivo",
    ])
      ids.push((await createPlayer(db, n)).id);
  });
  afterAll(() => {
    db.$client.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows segura o arquivo por um instante.
    }
  });

  const view = async (id: number) => editionView(await loadAll(db), id)!;
  let number = 0;
  async function started(
    config: FormatConfig,
    players: number[],
    teams?: string[],
  ) {
    const ed = await createEdition(db, {
      name: `Copa ${++number}`,
      number,
      game: "FIFA",
      playedOn: "2026-11-21",
      config,
      playerIds: players,
      useTeams: !!teams,
      ...(teams ? { teamPool: teams } : {}),
    });
    if (teams) await drawTeams(db, ed.id);
    await startEdition(db, ed.id);
    return ed.id;
  }

  it("mantém os placares, entra no menor grupo e cria só os jogos dele", async () => {
    const edId = await started(base, ids.slice(0, 8));
    const before = (await view(edId)).matches.filter(
      (m) => m.stage === "grupo",
    );
    await saveMatchResult(db, before[0].id, { homeScore: 2, awayScore: 1 });
    const res = await addLateEntry(db, edId, { playerId: ids[8] });
    expect(res.groupLabel).toBe("A");
    expect(res.games).toBe(4);
    const v = await view(edId);
    expect(v.edition.status).toBe("andamento");
    expect(v.entries).toHaveLength(9);
    const first = v.matches.find((m) => m.id === before[0].id)!;
    expect([first.homeScore, first.awayScore]).toEqual([2, 1]);
    expect(v.matches.filter((m) => m.stage === "grupo")).toHaveLength(
      before.length + 4,
    );
    await expect(addLateEntry(db, edId, { playerId: ids[8] })).rejects.toThrow(
      /já está/,
    );
  });

  it("cadastra quem é novo e respeita o grupo escolhido", async () => {
    const edId = await started(base, ids.slice(0, 8));
    const res = await addLateEntry(db, edId, {
      newName: "Juca",
      groupLabel: "B",
    });
    expect(res.groupLabel).toBe("B");
    const v = await view(edId);
    const juca = v.entries.find((e) => e.player.name === "Juca")!;
    expect(juca.groupLabel).toBe("B");
    await expect(
      addLateEntry(db, edId, { newName: "Lia", groupLabel: "Z" }),
    ).rejects.toThrow(UserError);
  });

  it("nas edições com times, exige um time livre", async () => {
    const teams = [
      "Ajax",
      "Benfica",
      "Celtic",
      "Dortmund",
      "Everton",
      "Fiorentina",
      "Getafe",
      "Hertha",
      "Inter",
    ];
    const edId = await started(base, ids.slice(0, 8), teams);
    const v = await view(edId);
    const taken = v.entries[0].team!.name;
    await expect(addLateEntry(db, edId, { playerId: ids[8] })).rejects.toThrow(
      /time/,
    );
    await expect(
      addLateEntry(db, edId, { playerId: ids[8], team: taken }),
    ).rejects.toThrow(/já está com outro/);
    const free = teams.find((t) => !v.entries.some((e) => e.team?.name === t))!;
    await addLateEntry(db, edId, { playerId: ids[8], team: free });
    const after = await view(edId);
    expect(after.entries.find((e) => e.playerId === ids[8])?.team?.name).toBe(
      free,
    );
  });

  it("não vale no mata-mata puro nem depois de o mata-mata ter placar", async () => {
    const mata = await started(
      { ...base, format: "mata", groupsCount: 0 },
      ids.slice(0, 4),
    );
    await expect(addLateEntry(db, mata, { playerId: ids[8] })).rejects.toThrow(
      /mata-mata puro/,
    );

    const edId = await started(
      { ...base, format: "liga", qualifiers: 2 },
      ids.slice(0, 4),
    );
    for (const m of (await view(edId)).matches.filter(
      (m) => m.stage === "grupo",
    ))
      await saveMatchResult(db, m.id, { homeScore: 1, awayScore: 0 });
    const final = (await view(edId)).matches.find((m) => m.stage === "mata")!;
    expect(final.homeEntryId).not.toBeNull(); // classificados já definidos
    // Ainda sem placar no mata-mata: pode, e a final volta a esperar a liga.
    await addLateEntry(db, edId, { playerId: ids[8] });
    const again = (await view(edId)).matches.find((m) => m.id === final.id)!;
    expect(again.homeEntryId).toBeNull();
    // Com placar no mata-mata: não pode mais.
    for (const m of (await view(edId)).matches.filter(
      (m) => m.stage === "grupo" && m.homeScore == null,
    ))
      await saveMatchResult(db, m.id, { homeScore: 0, awayScore: 0 });
    const ready = (await view(edId)).matches.find((m) => m.id === final.id)!;
    await saveMatchResult(db, ready.id, { homeScore: 1, awayScore: 0 });
    const blockedEd = (await view(edId)).edition;
    await expect(
      addLateEntry(db, blockedEd.id, { newName: "Zeca" }),
    ).rejects.toThrow(UserError);
  });

  it("sorteia o time entre os que sobraram do sorteio", async () => {
    const teams = [
      "Ajax",
      "Benfica",
      "Celtic",
      "Dortmund",
      "Everton",
      "Fiorentina",
      "Getafe",
      "Hertha",
      "Inter",
      "Juve",
    ];
    const edId = await started(base, ids.slice(0, 8), teams);
    const v = await view(edId);
    const used = new Set(v.entries.map((e) => e.team!.name));
    const free = teams.filter((t) => !used.has(t));
    expect(free).toHaveLength(2);

    const res = await addLateEntry(db, edId, {
      playerId: ids[8],
      drawTeam: true,
    });
    expect(res.drawnFrom?.sort()).toEqual([...free].sort());
    expect(free).toContain(res.team);
    expect(res.player.name).toBe("Ivo");
    const after = await view(edId);
    expect(after.entries.find((e) => e.playerId === ids[8])?.team?.name).toBe(
      res.team,
    );

    // Sobrou um: o próximo sorteio só pode dar ele.
    const second = await addLateEntry(db, edId, {
      newName: "Juca",
      drawTeam: true,
    });
    expect(second.drawnFrom).toEqual(free.filter((t) => t !== res.team));
    // Acabou a urna: tem que digitar.
    await expect(
      addLateEntry(db, edId, { newName: "Lia", drawTeam: true }),
    ).rejects.toThrow(/Não sobrou/);
  });

  it("time escolhido não vem como sorteio", async () => {
    const edId = await started(base, ids.slice(0, 8));
    const res = await addLateEntry(db, edId, { playerId: ids[8] });
    expect(res.drawnFrom).toBeNull();
    expect(res.team).toBeNull();
  });

  it("antes de gerar a tabela, manda usar Participantes", async () => {
    const ed = await createEdition(db, {
      name: "Copa espera",
      number: 99,
      game: "FIFA",
      playedOn: "2026-11-21",
      config: base,
      useTeams: false,
      playerIds: ids.slice(0, 8),
    });
    await expect(addLateEntry(db, ed.id, { playerId: ids[8] })).rejects.toThrow(
      /Participantes/,
    );
    expect(
      await db.select().from(matches).where(eq(matches.editionId, ed.id)),
    ).toHaveLength(0);
  });
});

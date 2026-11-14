import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("players_name_idx").on(t.name)],
);

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("teams_name_idx").on(t.name)],
);

export const editions = sqliteTable("editions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  game: text("game").notNull(),
  playedOn: text("played_on"),
  /** grupos | liga | mata | manual */
  format: text("format").notNull(),
  groupsCount: integer("groups_count").notNull().default(0),
  legs: integer("legs").notNull().default(1),
  /** Confrontos da fase de grupos: interno | cruzado | misto */
  pairing: text("pairing").notNull().default("interno"),
  /** No misto: adversários do outro grupo que cada um enfrenta (0 = todos). */
  crossGames: integer("cross_games").notNull().default(0),
  qualifiers: integer("qualifiers").notNull().default(0),
  thirdPlace: integer("third_place", { mode: "boolean" })
    .notNull()
    .default(false),
  /** inscricoes | andamento | encerrada */
  status: text("status").notNull().default("inscricoes"),
  /** Falso = torneio só com os jogadores, sem times. */
  useTeams: integer("use_teams", { mode: "boolean" }).notNull().default(true),
  /** Times disponíveis para o sorteio (JSON com os nomes). */
  teamPool: text("team_pool", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const entries = sqliteTable(
  "entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id").references(() => teams.id),
    groupLabel: text("group_label"),
    seed: integer("seed").notNull().default(0),
    /** Colocação final: campeao, vice, terceiro, quarto, semifinal, ... */
    result: text("result"),
  },
  (t) => [
    uniqueIndex("entries_edition_player_idx").on(t.editionId, t.playerId),
    index("entries_player_idx").on(t.playerId),
  ],
);

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    /** grupo | mata | terceiro */
    stage: text("stage").notNull(),
    round: integer("round").notNull(),
    slot: integer("slot").notNull(),
    groupLabel: text("group_label"),
    homeEntryId: integer("home_entry_id").references(() => entries.id, {
      onDelete: "cascade",
    }),
    awayEntryId: integer("away_entry_id").references(() => entries.id, {
      onDelete: "cascade",
    }),
    /** De onde vem o participante quando ainda não está definido (ex.: G:A:1, W:1:0). */
    homeSource: text("home_source"),
    awaySource: text("away_source"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homePens: integer("home_pens"),
    awayPens: integer("away_pens"),
    playedAt: text("played_at"),
  },
  (t) => [index("matches_edition_idx").on(t.editionId)],
);

export type Player = typeof players.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Edition = typeof editions.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Match = typeof matches.$inferSelect;

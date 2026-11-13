import { createClient, type ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

/** Tipo comum à conexão e às transações, para os serviços aceitarem ambos. */
export type Db = BaseSQLiteDatabase<"async", ResultSet, typeof schema>;

export function databaseUrl() {
  return process.env.TURSO_DATABASE_URL || "file:./data/copinha.db";
}

export function createDb(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  __copinhaDb?: ReturnType<typeof createDb>;
};

/** Conexão da aplicação, aberta no primeiro uso e reaproveitada depois. */
export function getDb() {
  globalForDb.__copinhaDb ??= createDb(
    databaseUrl(),
    process.env.TURSO_AUTH_TOKEN || undefined,
  );
  return globalForDb.__copinhaDb;
}

export { schema };

import { createClient, type ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

/** Tipo comum à conexão e às transações, para os serviços aceitarem ambos. */
export type Db = BaseSQLiteDatabase<"async", ResultSet, typeof schema>;

/**
 * Banco usado pelo site. COPINHA_DATABASE_URL (e _TOKEN) têm prioridade sobre
 * as variáveis do Turso: a integração da Vercel cria uma branch do banco a
 * cada deploy e aponta TURSO_DATABASE_URL para ela, então os dados lançados
 * num deploy não aparecem no seguinte. Apontando COPINHA_* para o banco
 * principal, todo deploy usa os mesmos dados.
 */
export function databaseUrl() {
  return (
    process.env.COPINHA_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    "file:./data/copinha.db"
  );
}

export function databaseToken() {
  return process.env.COPINHA_DATABASE_URL
    ? process.env.COPINHA_DATABASE_TOKEN || undefined
    : process.env.TURSO_AUTH_TOKEN || undefined;
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
  globalForDb.__copinhaDb ??= createDb(databaseUrl(), databaseToken());
  return globalForDb.__copinhaDb;
}

export { schema };

// Aplica as migrações do banco. Local: arquivo SQLite em ./data.
// Produção: banco Turso definido em TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // arquivo opcional
  }
}

const url = process.env.TURSO_DATABASE_URL || "file:./data/copinha.db";

if (url.startsWith("file:")) {
  mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  if (process.env.VERCEL) {
    console.warn(
      "Aviso: TURSO_DATABASE_URL não está definida. Em produção o banco precisa ser o Turso; um arquivo local não persiste.",
    );
  }
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();

console.log(`Banco atualizado: ${url.startsWith("file:") ? url : new URL(url).host}`);

// Aplica as migrações do banco. Local: arquivo SQLite em ./data.
// Produção: banco Turso definido em TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
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

/** Guarda uma cópia do banco local antes de migrar (as 5 mais recentes). */
function backup(file) {
  if (!existsSync(file) || statSync(file).size === 0) return;
  const dir = join(dirname(file), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(file, join(dir, `${basename(file)}.${stamp}`));
  const old = readdirSync(dir).sort().slice(0, -5);
  for (const name of old) rmSync(join(dir, name));
}

const url = process.env.TURSO_DATABASE_URL || "file:./data/copinha.db";

if (url.startsWith("file:")) {
  // Num servidor de hospedagem o disco é apagado a cada deploy: um banco em
  // arquivo perderia todos os dados. Melhor parar o build do que perder tudo.
  if (process.env.VERCEL) {
    console.error(
      "ERRO: TURSO_DATABASE_URL não está definida. Em produção o banco precisa ser o Turso: um arquivo local é apagado a cada deploy e todos os dados se perderiam. Cadastre TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis do projeto.",
    );
    process.exit(1);
  }
  const file = url.slice("file:".length);
  mkdirSync(dirname(file), { recursive: true });
  backup(file);
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();

console.log(`Banco atualizado: ${url.startsWith("file:") ? url : new URL(url).host}`);

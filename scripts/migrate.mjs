// Aplica as migrações do banco. Local: arquivo SQLite em ./data.
// Produção: banco Turso definido em COPINHA_DATABASE_URL / COPINHA_DATABASE_TOKEN
// ou, se não houver, em TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (mesma regra de
// src/db/index.ts).
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

const url =
  process.env.COPINHA_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  "file:./data/copinha.db";
const authToken = process.env.COPINHA_DATABASE_URL
  ? process.env.COPINHA_DATABASE_TOKEN || undefined
  : process.env.TURSO_AUTH_TOKEN || undefined;

if (url.startsWith("file:")) {
  // Num servidor de hospedagem o disco é apagado a cada deploy: um banco em
  // arquivo perderia todos os dados. Melhor parar o build do que perder tudo.
  if (process.env.VERCEL) {
    console.error(
      "ERRO: nenhum banco na nuvem configurado (COPINHA_DATABASE_URL ou TURSO_DATABASE_URL). Em produção o banco precisa ser o Turso: um arquivo local é apagado a cada deploy e todos os dados se perderiam. Cadastre as variáveis do banco nas configurações do projeto.",
    );
    process.exit(1);
  }
  const file = url.slice("file:".length);
  mkdirSync(dirname(file), { recursive: true });
  backup(file);
}

const client = createClient({
  url,
  authToken,
});

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();

console.log(`Banco atualizado: ${url.startsWith("file:") ? url : new URL(url).host}`);

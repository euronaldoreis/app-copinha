// Cadastra os times das ligas listadas em scripts/times.json (Brasileirão A, B
// e C, Inglaterra, Itália, Espanha, Portugal, França, Alemanha, Holanda,
// Argentina, MLS, Chile, Paraguai, Uruguai, Venezuela, Bolívia, Colômbia, Peru,
// Equador e México). Só acrescenta: times que já existem (mesmo nome, sem
// diferenciar maiúsculas) ficam como estão, e dá para rodar quantas vezes quiser.
//
// Usa o mesmo banco do app: o arquivo local em ./data ou, se definido, o banco
// na nuvem de COPINHA_DATABASE_URL / TURSO_DATABASE_URL (veja scripts/migrate.mjs).
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // arquivo opcional
  }
}

const url =
  process.env.COPINHA_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  "file:./data/copinha.db";
const authToken = process.env.COPINHA_DATABASE_URL
  ? process.env.COPINHA_DATABASE_TOKEN || undefined
  : process.env.TURSO_AUTH_TOKEN || undefined;

/** Mesma comparação de nomes do app (src/lib/services.ts). */
const key = (name) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

const leagues = JSON.parse(
  readFileSync(new URL("./times.json", import.meta.url), "utf8"),
);

const client = createClient({ url, authToken });
const existing = new Set(
  (await client.execute("SELECT name FROM teams")).rows.map((r) => key(String(r.name))),
);

const added = [];
for (const [league, names] of Object.entries(leagues)) {
  const fresh = names
    .map((n) => n.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter((n) => !existing.has(key(n)));
  for (const n of fresh) existing.add(key(n));
  if (fresh.length)
    await client.batch(
      fresh.map((name) => ({ sql: "INSERT INTO teams (name) VALUES (?)", args: [name] })),
      "write",
    );
  added.push(...fresh);
  console.log(`${league}: ${fresh.length} de ${names.length} cadastrados`);
}
client.close();

const where = url.startsWith("file:") ? url : new URL(url).host;
console.log(`\n${added.length} times novos em ${where}.`);

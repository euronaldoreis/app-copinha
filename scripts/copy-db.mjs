// Copia todos os dados de um banco para outro (por exemplo, de uma branch do
// Turso ou do arquivo local para o banco principal de produção).
//
// Uso (as variáveis vêm do terminal, nunca ficam no código):
//   SOURCE_DATABASE_URL=libsql://origem.turso.io SOURCE_DATABASE_TOKEN=... \
//   TARGET_DATABASE_URL=libsql://destino.turso.io TARGET_DATABASE_TOKEN=... \
//   node scripts/copy-db.mjs [--dry-run] [--replace]
//
// - Sem SOURCE_DATABASE_URL, a origem é o arquivo local ./data/copinha.db.
// - O destino é migrado antes (cria as tabelas se faltarem).
// - Se o destino já tiver dados, o script para. Só com --replace ele apaga os
//   dados do destino antes de copiar.
// - --dry-run só mostra o que seria copiado.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const dryRun = process.argv.includes("--dry-run");
const replace = process.argv.includes("--replace");

// Ordem que respeita as chaves estrangeiras (pais antes dos filhos).
const TABLES = ["players", "player_photos", "teams", "editions", "entries", "matches"];

const sourceUrl = process.env.SOURCE_DATABASE_URL || "file:./data/copinha.db";
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl) {
  console.error("Defina TARGET_DATABASE_URL (e TARGET_DATABASE_TOKEN) com o banco de destino.");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("Origem e destino são o mesmo banco.");
  process.exit(1);
}

const host = (url) => (url.startsWith("file:") ? url : new URL(url).host);

const source = createClient({
  url: sourceUrl,
  authToken: process.env.SOURCE_DATABASE_TOKEN || undefined,
});
const target = createClient({
  url: targetUrl,
  authToken: process.env.TARGET_DATABASE_TOKEN || undefined,
});

const count = async (db, table) =>
  Number((await db.execute(`select count(*) as n from ${table}`)).rows[0].n);

console.log(`Origem:  ${host(sourceUrl)}`);
console.log(`Destino: ${host(targetUrl)}`);

// 1) o destino precisa ter as tabelas
if (!dryRun) await migrate(drizzle(target), { migrationsFolder: "./drizzle" });

// 2) lê tudo da origem
const data = {};
for (const table of TABLES) {
  try {
    data[table] = (await source.execute(`select * from ${table}`)).rows.map((row) => ({ ...row }));
  } catch (error) {
    // Banco de origem mais antigo, sem essa tabela: não há nada a copiar dela.
    if (!/no such table/i.test(String(error?.message ?? error))) throw error;
    data[table] = [];
  }
}

// 3) confere o destino
let existing = 0;
for (const table of TABLES) {
  try {
    existing += await count(target, table);
  } catch {
    // tabela ainda não existe no destino (só acontece no --dry-run)
  }
}

console.log("\nPara copiar:");
for (const table of TABLES) console.log(`  ${table}: ${data[table].length}`);
if (existing > 0) console.log(`\nO destino já tem ${existing} registros.`);

if (existing > 0 && !replace) {
  console.error(
    "\nParei: o destino não está vazio. Para apagar o que há nele e colocar os dados da origem, rode de novo com --replace.",
  );
  process.exit(1);
}
if (dryRun) {
  console.log("\n(dry-run: nada foi alterado)");
  process.exit(0);
}

// 4) copia tudo de uma vez: se algo falhar, nada muda no destino
const statements = [];
if (replace) {
  for (const table of [...TABLES].reverse()) statements.push(`delete from ${table}`);
}
for (const table of TABLES) {
  for (const row of data[table]) {
    const columns = Object.keys(row);
    statements.push({
      sql: `insert into ${table} (${columns.join(", ")}) values (${columns.map(() => "?").join(", ")})`,
      args: columns.map((c) => row[c]),
    });
  }
}
await target.batch(statements, "write");

// 5) confere
let ok = true;
console.log("\nConferência no destino:");
for (const table of TABLES) {
  const n = await count(target, table);
  const expected = data[table].length;
  if (n !== expected) ok = false;
  console.log(`  ${table}: ${n}${n === expected ? "" : `  (esperado ${expected})`}`);
}
source.close();
target.close();
console.log(ok ? "\nPronto: dados copiados." : "\nATENÇÃO: contagens diferentes.");
process.exit(ok ? 0 : 1);

import { defineConfig } from "drizzle-kit";

// Usado apenas para gerar as migrações (npm run db:generate).
// A aplicação das migrações é feita por scripts/migrate.mjs.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});

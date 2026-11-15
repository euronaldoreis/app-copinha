// Limite de tentativas de login. Uma senha só protege tudo, então quem erra
// muitas vezes seguidas fica bloqueado até a janela de contagem acabar. O
// contador fica no banco (e não na memória) porque na Vercel cada requisição
// pode cair numa instância diferente.
import { sql } from "drizzle-orm";
import type { Db } from "@/db";

/** Tentativas permitidas dentro de uma janela. */
export const MAX_ATTEMPTS = 5;
/** Duração da janela, e do bloqueio, em ms. */
export const WINDOW_MS = 15 * 60 * 1000;

export interface AttemptResult {
  /** Passou do limite: nem confere a senha. */
  blocked: boolean;
  /** Quanto falta para o bloqueio acabar (ms), quando bloqueado. */
  retryAfterMs: number;
}

/**
 * Conta uma tentativa de login desta origem. A contagem acontece ANTES de
 * conferir a senha e de forma atômica, para uma rajada de pedidos em paralelo
 * não passar toda pela mesma checagem.
 */
export async function countAttempt(
  db: Db,
  key: string,
  now = Date.now(),
): Promise<AttemptResult> {
  const rows = await db.all<{ failures: number; window_start: number }>(sql`
    INSERT INTO login_attempts (key, failures, window_start)
    VALUES (${key}, 1, ${now})
    ON CONFLICT(key) DO UPDATE SET
      failures = CASE WHEN ${now} - window_start >= ${WINDOW_MS} THEN 1 ELSE failures + 1 END,
      window_start = CASE WHEN ${now} - window_start >= ${WINDOW_MS} THEN ${now} ELSE window_start END
    RETURNING failures, window_start
  `);
  const row = rows[0];
  if (!row || row.failures <= MAX_ATTEMPTS) return { blocked: false, retryAfterMs: 0 };
  return { blocked: true, retryAfterMs: Math.max(0, row.window_start + WINDOW_MS - now) };
}

/** Login certo: zera a contagem desta origem. */
export async function clearAttempts(db: Db, key: string) {
  await db.run(sql`DELETE FROM login_attempts WHERE key = ${key}`);
}

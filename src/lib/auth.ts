// Login único de administrador: quem sabe a senha (ADMIN_PASSWORD) pode editar.
// Todo o resto do site é público, só para leitura.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { clearAttempts, countAttempt } from "./loginLimit";
import { getPlayerAccessHash } from "./services";

const COOKIE = "copinha_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function password() {
  return process.env.ADMIN_PASSWORD || "";
}

function secret() {
  return process.env.AUTH_SECRET || `copinha:${password()}`;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminConfigured() {
  return password().length > 0;
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires))) return false;
  return Number(expires) > Date.now();
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Não autorizado");
}

/** De onde veio o pedido (a Vercel preenche x-forwarded-for com o IP real). */
async function originKey() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "desconhecido";
}

export type LoginResult =
  | { ok: true }
  | { ok: false; blocked: false }
  | { ok: false; blocked: true; retryAfterMs: number };

/** Confere a senha e, se estiver certa, grava o cookie de sessão. */
export async function login(attempt: string): Promise<LoginResult> {
  const key = await originKey();
  try {
    const counted = await countAttempt(getDb(), key);
    if (counted.blocked) {
      return { ok: false, blocked: true, retryAfterMs: counted.retryAfterMs };
    }
  } catch (err) {
    // Se o contador falhar, o login continua funcionando (só sem o limite),
    // para um problema no banco não trancar quem administra.
    console.error("Limite de login indisponível:", err);
  }
  if (!adminConfigured() || !safeEqual(attempt, password())) {
    // Atraso simples para desestimular tentativa e erro.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { ok: false, blocked: false };
  }
  await clearAttempts(getDb(), key).catch(() => {});
  const expires = String(Date.now() + MAX_AGE * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

// --- Sessão do jogador -----------------------------------------------------
// Quem abre o link de acesso do jogador ganha um cookie que só vale para editar
// o próprio perfil. O cookie é amarrado ao hash do acesso: gerar outro link ou
// desativar o acesso derruba as sessões abertas.

const PLAYER_COOKIE = "copinha_jogador";

/** Sem segredo configurado a assinatura seria previsível: sessão de jogador desligada. */
function playerSessionsEnabled() {
  return Boolean(process.env.AUTH_SECRET || password());
}

function playerSignature(payload: string) {
  return sign(`jogador:${payload}`);
}

export async function startPlayerSession(playerId: number, accessHash: string) {
  if (!playerSessionsEnabled()) return false;
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `${playerId}.${expires}.${accessHash.slice(0, 16)}`;
  (await cookies()).set(PLAYER_COOKIE, `${payload}.${playerSignature(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return true;
}

export async function endPlayerSession() {
  (await cookies()).delete(PLAYER_COOKIE);
}

/** Id do jogador da sessão atual, ou null se não há sessão válida. */
export async function currentPlayerId(): Promise<number | null> {
  if (!playerSessionsEnabled()) return null;
  const token = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [rawId, expires, hashPrefix, signature] = parts;
  const payload = `${rawId}.${expires}.${hashPrefix}`;
  if (!safeEqual(signature, playerSignature(payload))) return null;
  if (!(Number(expires) > Date.now())) return null;
  const playerId = Number(rawId);
  if (!Number.isInteger(playerId)) return null;
  const current = await getPlayerAccessHash(getDb(), playerId);
  if (!current || current.slice(0, 16) !== hashPrefix) return null;
  return playerId;
}

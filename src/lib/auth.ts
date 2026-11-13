// Login único de administrador: quem sabe a senha (ADMIN_PASSWORD) pode editar.
// Todo o resto do site é público, só para leitura.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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

/** Confere a senha e, se estiver certa, grava o cookie de sessão. */
export async function login(attempt: string) {
  if (!adminConfigured() || !safeEqual(attempt, password())) {
    // Atraso simples para desestimular tentativa e erro.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return false;
  }
  const expires = String(Date.now() + MAX_AGE * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

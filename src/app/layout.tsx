import type { Metadata, Viewport } from "next";
import { Jersey_10, Jersey_20, Press_Start_2P } from "next/font/google";
import Link from "next/link";
import { logoutAction } from "./actions";
import { NavBar } from "@/components/NavBar";
import { BallIcon, LockIcon } from "@/components/icons";
import { isAdmin } from "@/lib/auth";
import "./globals.css";

// Texto corrido: pixelada, estreita e legível em frases longas.
const bodyFont = Jersey_10({
  variable: "--font-body",
  weight: "400",
  subsets: ["latin"],
});

// Mesma família, mais encorpada: faz o papel do negrito (nomes, destaques).
const strongFont = Jersey_20({
  variable: "--font-bold",
  weight: "400",
  subsets: ["latin"],
});

// Títulos, botões e rótulos: a clássica fonte de 8x8 pixels.
const displayFont = Press_Start_2P({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// Tudo é lido do banco a cada visita: os placares mudam durante a Copinha.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Copinha dos Lixos", template: "%s · Copinha dos Lixos" },
  description:
    "Histórico, tabelas e ranking da Copinha dos Lixos, o torneio de FIFA e Bomba Patch da galera.",
};

export const viewport: Viewport = {
  themeColor: "#04051a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const admin = await isAdmin();
  return (
    <html
      lang="pt-BR"
      className={`${bodyFont.variable} ${strongFont.variable} ${displayFont.variable} h-full`}
    >
      <body className="min-h-full">
        {/* Barra de cima, como o placar fixo de um jogo. */}
        <div className="border-b-[3px] border-ink bg-night">
          <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-pixel text-[9px] uppercase text-accent"
            >
              <BallIcon width={16} height={16} className="text-ink" />
              Copinha dos Lixos
            </Link>
            {admin ? (
              <form action={logoutAction}>
                <button type="submit" className="btn btn-quiet min-h-0">
                  Sair
                </button>
              </form>
            ) : (
              <Link href="/admin" className="btn btn-quiet min-h-0">
                <LockIcon width={14} height={14} />
                Entrar
              </Link>
            )}
          </div>
        </div>
        <main className="mx-auto w-full max-w-3xl px-6 pb-36 pt-6">
          {children}
        </main>
        <NavBar />
      </body>
    </html>
  );
}

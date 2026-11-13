import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { logoutAction } from "./actions";
import { NavBar } from "@/components/NavBar";
import { LockIcon } from "@/components/icons";
import { isAdmin } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  themeColor: "#f3f3ef",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const admin = await isAdmin();
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-4">
          <Link href="/" className="text-body font-semibold text-muted">
            Copinha dos Lixos
          </Link>
          {admin ? (
            <form action={logoutAction}>
              <button type="submit" className="btn btn-quiet">
                Sair do modo admin
              </button>
            </form>
          ) : (
            <Link href="/admin" className="btn btn-quiet">
              <LockIcon width={18} height={18} />
              Entrar
            </Link>
          )}
        </div>
        <main className="mx-auto w-full max-w-3xl px-6 pb-36 pt-6">
          {children}
        </main>
        <NavBar />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Jersey_10, Jersey_20, Press_Start_2P } from "next/font/google";
import Link from "next/link";
import { logoutAction } from "./actions";
import { NavBar } from "@/components/NavBar";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { Splash } from "@/components/Splash";
import { TopBarBrand } from "@/components/TopBarBrand";
import { LockIcon } from "@/components/icons";
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

// Endereço público do site: as imagens de pré-visualização precisam de um link
// absoluto. Na Vercel ele vem das variáveis do projeto; para domínio próprio,
// defina NEXT_PUBLIC_SITE_URL.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const description =
  "Histórico, tabelas e ranking da Copinha dos Lixos, o torneio de FIFA e Bomba Patch da galera.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Copinha dos Lixos", template: "%s · Copinha dos Lixos" },
  description,
  openGraph: {
    title: "Copinha dos Lixos",
    description,
    siteName: "Copinha dos Lixos",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Copinha", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#04051a",
  // No app instalado a tela vai até as bordas do aparelho; as barras de cima e
  // de baixo se afastam do entalhe e da barra de gestos com env(safe-area-*).
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const admin = await isAdmin();
  return (
    <html
      lang="pt-BR"
      className={`${bodyFont.variable} ${strongFont.variable} ${displayFont.variable} h-full`}
    >
      <body className="min-h-full">
        <Splash />
        <RegisterServiceWorker />
        {/* Barra de cima, como o placar fixo de um jogo: acompanha a rolagem. */}
        <div className="sticky top-0 z-40 border-b-[3px] border-ink bg-night pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-2 px-6">
            <TopBarBrand />
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

import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import Link from "next/link";
import { logoutAction } from "./actions";
import { NavBar } from "@/components/NavBar";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { Splash } from "@/components/Splash";
import { TopBarBrand } from "@/components/TopBarBrand";
import { LockIcon, LogoutIcon } from "@/components/icons";
import { Ball3D, Trophy3D } from "@/components/icons3d";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import "./globals.css";

// Texto corrido: redonda e legível, com peso para os destaques.
const bodyFont = Nunito({
  variable: "--font-body",
  weight: ["700", "800", "900"],
  subsets: ["latin"],
});

// Títulos, botões e rótulos: letra gorda de jogo, sempre com contorno.
const displayFont = Lilita_One({
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
  themeColor: "#17357f",
  // No app instalado a tela vai até as bordas do aparelho; as barras de cima e
  // de baixo se afastam do entalhe e da barra de gestos com env(safe-area-*).
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [admin, data] = await Promise.all([isAdmin(), getData()]);
  const editions = data.editions.filter((e) => e.status !== "inscricoes").length;
  const games = data.matches.filter((m) => m.homeScore != null).length;
  return (
    <html
      lang="pt-BR"
      className={`${bodyFont.variable} ${displayFont.variable} h-full`}
    >
      <body className="min-h-full">
        <Splash />
        <RegisterServiceWorker />
        {/* Barra de cima, como o painel de um jogo: marca, contadores e conta. */}
        <div className="sticky top-0 z-40 border-b-2 border-night bg-[#17357f] pt-[env(safe-area-inset-top)] shadow-[0_2px_0_#2f56b8]">
          <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-2 px-3.5">
            <TopBarBrand />
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="pill" title={`${editions} edições`}>
                <Trophy3D width={22} height={22} />
                <span className="num">{editions}</span>
              </span>
              <span className="pill" title={`${games} jogos`}>
                <Ball3D width={22} height={22} />
                <span className="num">{games}</span>
              </span>
              {admin ? (
                <form action={logoutAction}>
                  <button type="submit" className="btn-hud" aria-label="Sair">
                    <LogoutIcon width={20} height={20} />
                  </button>
                </form>
              ) : (
                <Link href="/admin" className="btn-hud" aria-label="Entrar como organizador">
                  <LockIcon width={20} height={20} />
                </Link>
              )}
            </div>
          </div>
        </div>
        <main className="mx-auto w-full max-w-3xl px-4 pb-36 pt-5">
          {children}
        </main>
        <NavBar />
      </body>
    </html>
  );
}

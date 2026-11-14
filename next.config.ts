import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os dados mudam a cada placar lançado e a interface depende de quem está
  // logado, então as páginas são renderizadas a cada requisição (ver
  // `dynamic = "force-dynamic"` em src/app/layout.tsx).
  cacheComponents: false,
  // O service worker não pode ficar preso no cache do navegador, senão as
  // atualizações dele nunca chegam.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

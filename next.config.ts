import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os dados mudam a cada placar lançado e a interface depende de quem está
  // logado, então as páginas são renderizadas a cada requisição (ver
  // `dynamic = "force-dynamic"` em src/app/layout.tsx).
  cacheComponents: false,
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

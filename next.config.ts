import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de fichier AGENTS.md généré à la racine quand un assistant IA lance
  // `next dev`.
  agentRules: false,
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

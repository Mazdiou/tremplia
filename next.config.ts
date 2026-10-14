import type { NextConfig } from "next";

// En-têtes de sécurité de toutes les réponses : aucune page ne peut être
// affichée dans le cadre d'un autre site (un bouton « Je valide » ou
// « Afficher le mot de passe » ne doit pas pouvoir être cliqué à l'insu de
// l'utilisateur), ni un fichier interprété autrement que son type déclaré.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Pas de fichier AGENTS.md généré à la racine quand un assistant IA lance
  // `next dev`.
  agentRules: false,
  // Pas d'en-tête « X-Powered-By: Next.js »
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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

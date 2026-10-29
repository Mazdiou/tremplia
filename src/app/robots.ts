import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Moteurs de recherche : seules les pages publiques les intéressent, le
// reste demande une connexion. Les pages utilitaires (mot de passe, lien
// reçu par e-mail) ne sont pas interdites ici mais marquées « noindex » :
// interdites, le moteur ne lirait pas cette consigne et pourrait garder leur
// adresse dans ses résultats.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/offline"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

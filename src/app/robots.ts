import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Moteurs de recherche : seules les pages publiques les intéressent, le
// reste demande une connexion
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/reset-password", "/change-password", "/offline"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

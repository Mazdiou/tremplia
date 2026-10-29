import type { MetadataRoute } from "next";
import { LEGAL } from "@/config/legal";
import { siteUrl } from "@/lib/site-url";

// Pages publiques, pour les moteurs de recherche. Date de modification
// seulement quand elle est connue (pages légales) : une date inventée, comme
// celle du build, ferait ignorer toutes les autres.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  const legal = new Date(`${LEGAL.updatedAt}T00:00:00Z`);
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/student/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/mentions-legales`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/conditions`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/confidentialite`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
  ];
}

import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Pages publiques, pour les moteurs de recherche
export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/student/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

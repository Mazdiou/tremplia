import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Manifestes de l'application installable : un pour l'agence, un pour
// l'espace candidat (chacun s'ouvre sur sa propre page et apparaît sous son
// propre nom sur le téléphone).

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

function base(): MetadataRoute.Manifest {
  return {
    lang: "fr",
    dir: "ltr",
    display: "standalone",
    background_color: BRAND.colors.background,
    theme_color: BRAND.colors.background,
    icons: ICONS,
    categories: ["business", "productivity", "education"],
  };
}

export function agencyManifest(): MetadataRoute.Manifest {
  return {
    ...base(),
    id: "/",
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/dashboard",
    scope: "/",
    // Appui long sur l'icône (Android) : accès direct
    shortcuts: [
      { name: "Nouveau dossier", url: "/cases/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Dossiers", url: "/cases", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

export function studentManifest(): MetadataRoute.Manifest {
  return {
    ...base(),
    id: "/student",
    name: `${BRAND.name} · Espace candidat`,
    short_name: "Mon dossier",
    description: "Votre dossier, votre lettre de motivation, vos formations et vos messages.",
    start_url: "/student",
    scope: "/student",
  };
}

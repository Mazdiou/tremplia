import type { CampaignTemplate } from "./schema";

export const campusFrance20262027: CampaignTemplate = {
  key: "campus-france-2026-2027",
  name: "Campus France 2026/2027",
  description:
    "Procédure Études en France (Algérie) : dossiers DAP, hors-DAP et écoles.",
  suggestedPlatforms: ["Pastel"],
  groups: ["DAP", "Hors-DAP", "École"],
  dates: [
    { label: "Ouverture des candidatures", date: "2026-10-01" },
    { label: "Date limite hors-DAP", date: "2026-11-30" },
    { label: "Date limite DAP", date: "2026-12-15" },
    { label: "Date limite licences professionnelles et BUT", date: "2026-12-15" },
    { label: "Fin des entretiens", date: "2027-03-15" },
    { label: "Réponses des établissements", date: "2027-04-30" },
    { label: "Choix définitif", date: "2027-05-31" },
  ],
  infos: [],
};

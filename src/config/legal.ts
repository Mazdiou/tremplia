import { BRAND } from "./brand";

// Informations légales affichées par les pages /mentions-legales,
// /confidentialite et /conditions. Seul endroit à modifier quand le statut
// de l'éditeur change (auto-entrepreneur, société…) : une valeur à null
// n'est pas affichée.
export const LEGAL = {
  editor: {
    name: "Madiou Amine",
    // « Personne physique », puis par exemple « Auto-entrepreneur »
    status: "Personne physique",
    city: "Tizi Ouzou",
    country: "Algérie",
    // Numéros d'immatriculation, à renseigner une fois le statut créé
    nif: null as string | null,
    registration: null as string | null,
  },
  contact: BRAND.email.contact,
  // Date de la dernière modification des pages légales (AAAA-MM-JJ). La
  // changer à chaque modification des conditions.
  updatedAt: "2026-10-23",
  // Tribunal compétent en cas de litige
  court: "Tizi Ouzou",
  // Prestataires techniques : hébergement et services utilisés
  providers: [
    {
      name: "Vercel Inc.",
      role: "hébergement de l'application",
      place: "États-Unis ; calculs exécutés en Suède (Stockholm)",
      url: "https://vercel.com",
    },
    {
      name: "Supabase Inc.",
      role: "base de données, fichiers et comptes de connexion",
      place: "Suède (Stockholm, centre de données Amazon Web Services)",
      url: "https://supabase.com",
    },
    {
      name: "Resend",
      role: "envoi des e-mails de l'application",
      place: "États-Unis",
      url: "https://resend.com",
    },
    {
      name: "Sentry (Functional Software Inc.)",
      role: "suivi des erreurs techniques, données personnelles masquées",
      place: "Allemagne (région Europe)",
      url: "https://sentry.io",
    },
    {
      name: "Backblaze Inc.",
      role: "sauvegardes chiffrées",
      place: "stockage Backblaze B2",
      url: "https://www.backblaze.com",
    },
  ],
} as const;

// Liens vers les pages légales (pieds de page)
export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions", label: "Conditions" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;

import { BRAND } from "./brand";

// Informations légales affichées par les pages /mentions-legales,
// /confidentialite et /conditions. L'éditeur n'y figure que sous son
// pseudonyme, joignable seulement par l'adresse de contact : ni nom, ni
// ville, ni téléphone.
export const LEGAL = {
  editor: { name: "Mazdiou" },
  contact: BRAND.email.contact,
  // Date de la dernière modification des pages légales (AAAA-MM-JJ). La
  // changer à chaque modification des conditions.
  updatedAt: "2026-10-26",
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
      place: "États-Unis ; envoi depuis l'Irlande (région Europe)",
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

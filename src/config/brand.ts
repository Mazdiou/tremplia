// Nom de l'application, partout où il s'affiche (titres des pages, logos,
// accueil, tableau de bord). « StudyFlow » est provisoire : le changer ici
// seulement le jour où le nom définitif est choisi.
// Restent volontairement inchangés : les identifiants techniques
// « studyflow:… » de src/features/student/server/keys.ts (les changer
// invaliderait les codes et sessions des candidats).
export const BRAND = {
  name: "StudyFlow",
  tagline: "Le CRM des agences d'études à l'étranger",
} as const;

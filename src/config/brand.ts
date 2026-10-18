// Nom de l'application, partout où il s'affiche (titres des pages, logos,
// accueil, tableau de bord).
export const BRAND = {
  name: "Tremplia",
  tagline: "Le CRM des agences d'études à l'étranger",
  // Couleurs de l'application installée (icônes, écran de démarrage, barre
  // d'état du téléphone) : les mêmes que --primary et --background de
  // globals.css, en hexadécimal (le manifeste n'accepte pas oklch).
  colors: {
    primary: "#175dfc",
    background: "#f8fafc",
    backgroundDark: "#0d1014",
  },
} as const;

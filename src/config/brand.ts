// Nom de l'application, partout où il s'affiche (titres des pages, logos,
// accueil, tableau de bord, e-mails).
export const BRAND = {
  name: "Tremplia",
  tagline: "Le CRM des agences d'études à l'étranger",
  // Adresse publique du site (réglage SITE_URL pour une autre, en local par
  // exemple : voir src/lib/site-url.ts)
  url: "https://www.tremplia.com",
  // Adresses e-mail : l'expéditeur des e-mails de l'application (domaine
  // vérifié chez Resend) et l'adresse où l'on peut répondre
  email: {
    from: "noreply@tremplia.com",
    contact: "contact@tremplia.com",
  },
  // Couleurs de l'application installée (icônes, écran de démarrage, barre
  // d'état du téléphone) : les mêmes que --primary et --background de
  // globals.css, en hexadécimal (le manifeste n'accepte pas oklch).
  colors: {
    primary: "#175dfc",
    background: "#f8fafc",
    backgroundDark: "#0d1014",
  },
} as const;

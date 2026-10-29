import { BRAND } from "@/config/brand";

// Données structurées de la page d'accueil (schema.org, JSON-LD) : ce que
// les moteurs de recherche comprennent du site sans lire la page. Seulement
// ce qui est vrai et visible sur la page : pas de prix (tarifs non fixés),
// pas de note ni d'avis.

export function landingStructuredData({
  site,
  description,
  phone,
}: {
  // Adresse publique, sans « / » final (siteUrl())
  site: string;
  description: string;
  // Numéro international (chiffres seulement, ex. 213552753559), facultatif
  phone: string | null;
}) {
  const organization = `${site}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: BRAND.name,
        url: site,
        logo: `${site}/icons/icon-512.png`,
        email: BRAND.email.contact,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: BRAND.email.contact,
          ...(phone ? { telephone: `+${phone}` } : {}),
          availableLanguage: "French",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: site,
        name: BRAND.name,
        inLanguage: "fr",
        publisher: { "@id": organization },
      },
      {
        "@type": "SoftwareApplication",
        name: BRAND.name,
        url: site,
        description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        inLanguage: "fr",
        publisher: { "@id": organization },
      },
    ],
  };
}

// Texte du <script type="application/ld+json"> : « < » échappé, aucune
// valeur ne peut fermer la balise
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { LandingPage, type LandingContact } from "@/features/landing/components/landing-page";
import { supportPhone } from "@/features/subscription/server/subscription";
import { toWhatsAppNumber, whatsAppUrl } from "@/features/whatsapp/whatsapp";

const DESCRIPTION =
  "Candidats, étapes, documents, lettres de motivation, formations, paiements et échéances : le suivi des dossiers étudiants pour toute l'agence. Essai gratuit de 7 jours.";

export const metadata: Metadata = {
  // Titre complet : sans le modèle « … · nom » du layout racine
  title: { absolute: `${BRAND.name} · ${BRAND.tagline}` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Remplace celui du layout (pas de fusion champ par champ)
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "fr_FR",
    url: "/",
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: DESCRIPTION,
  },
};

// Page d'accueil publique. Une personne connectée n'y arrive pas : le proxy
// l'envoie sur son tableau de bord.
export default function Home() {
  const phone = supportPhone();
  const number = toWhatsAppNumber(phone);
  const contact: LandingContact = phone
    ? {
        phone,
        whatsappUrl: number
          ? whatsAppUrl(number, `Bonjour, je souhaite en savoir plus sur ${BRAND.name}.`)
          : null,
      }
    : null;
  return <LandingPage contact={contact} />;
}

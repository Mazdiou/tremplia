import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { ContactLink, LegalList, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Éditeur, hébergement et contact de ${BRAND.name}.`,
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" path="/mentions-legales">
      <LegalSection title="Éditeur">
        <p>
          {BRAND.name} est édité par <strong>{LEGAL.editor.name}</strong>, joignable à{" "}
          <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="Service">
        <p>
          {BRAND.name} ({new URL(BRAND.url).hostname}) est un logiciel en ligne de suivi des
          dossiers pour les agences qui accompagnent des candidats dans leurs démarches
          d&apos;études à l&apos;étranger. Ses conditions d&apos;utilisation et de vente sont
          décrites dans les <Link href="/conditions" className="text-link underline underline-offset-2">conditions générales</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement et prestataires techniques">
        <LegalList
          items={LEGAL.providers.map((p) => (
            <>
              <strong>{p.name}</strong> : {p.role}. Lieu : {p.place}.{" "}
              <a href={p.url} className="text-link underline underline-offset-2" rel="noopener noreferrer">
                {new URL(p.url).hostname.replace(/^www\./, "")}
              </a>
            </>
          ))}
        />
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le nom {BRAND.name}, son logo, ses textes et le logiciel lui-même appartiennent à
          l&apos;éditeur. Toute reproduction sans autorisation écrite est interdite. Les données
          saisies par une agence restent sa propriété.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          La façon dont les données sont collectées, utilisées et protégées est décrite dans la{" "}
          <Link href="/confidentialite" className="text-link underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

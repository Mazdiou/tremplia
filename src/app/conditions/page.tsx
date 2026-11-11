import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { ContactLink, LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { UNCONFIRMED_DAYS } from "@/features/auth/schemas";

export const metadata: Metadata = {
  title: "Conditions générales",
  description: `Conditions d'utilisation et de vente de ${BRAND.name} : essai, abonnement, paiement, données.`,
  alternates: { canonical: "/conditions" },
};

export default function ConditionsPage() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Conditions générales d'utilisation et de vente" path="/conditions">
      <LegalSection title="1. Objet">
        <p>
          Ces conditions encadrent l&apos;utilisation de {BRAND.name}, logiciel en ligne de suivi
          des dossiers proposé par {editor.name} (« l&apos;éditeur ») aux agences qui accompagnent
          des candidats dans leurs démarches d&apos;études à l&apos;étranger (« l&apos;agence »).
          Créer un compte vaut acceptation de ces conditions et de la{" "}
          <Link href="/confidentialite" className="text-link underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Compte de l'agence">
        <LegalList
          items={[
            `L'inscription est faite par le responsable de l'agence (« le patron »), avec une adresse e-mail qu'il confirme. Sans confirmation sous ${UNCONFIRMED_DAYS} jours, l'inscription est annulée.`,
            "Le patron peut ajouter des employés et choisir leurs permissions. Il est responsable des accès qu'il donne et des actions faites avec les comptes de son agence.",
            "Chacun garde son mot de passe secret. Un accès suspect doit être signalé sans délai à l'éditeur.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Essai gratuit">
        <p>
          Chaque nouvelle agence bénéficie de 7 jours d&apos;essai gratuit, avec toutes les
          fonctions. Aucun paiement n&apos;est demandé pour l&apos;essai, et rien n&apos;est
          prélevé à sa fin.
        </p>
      </LegalSection>

      <LegalSection title="4. Abonnement, prix et paiement">
        <LegalList
          items={[
            "Après l'essai, l'utilisation continue avec un abonnement d'un, trois ou douze mois.",
            "Le prix est communiqué à l'agence avant tout paiement, sur demande.",
            "Le paiement se fait en espèces, par CCP ou par BaridiMob. L'abonnement prend effet dès que l'éditeur enregistre le paiement ; une période payée pendant l'essai ou un abonnement en cours s'ajoute à sa fin.",
            "Il n'y a aucun renouvellement automatique : sans nouveau paiement, l'abonnement s'arrête à sa date de fin. Des rappels sont envoyés 7 jours puis 1 jour avant.",
            "Sauf accord contraire, une période commencée n'est pas remboursée.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Fin de l'essai ou de l'abonnement">
        <p>
          À la date de fin, l&apos;agence passe en lecture seule : ses dossiers, documents et
          données restent consultables, mais plus rien ne peut être ajouté ni modifié. Tout redevient
          modifiable dès le paiement suivant.
        </p>
      </LegalSection>

      <LegalSection title="6. Données de l'agence et de ses candidats">
        <LegalList
          items={[
            "Les données saisies restent la propriété de l'agence. Le patron peut les exporter (classeurs Excel des campagnes et des paiements, documents d'un dossier) et demander leur suppression.",
            "L'agence est responsable des données de ses candidats : elle les collecte de façon licite, informe ses candidats, ne saisit que ce qui est utile à leur dossier et, pour un candidat mineur, recueille l'accord de son représentant légal.",
            "Les fichiers que l'agence sort du service (exports, documents téléchargés, copie sur l'ordinateur, messages envoyés par WhatsApp) sont sous sa seule responsabilité.",
            "L'éditeur traite ces données pour le seul compte de l'agence, selon la politique de confidentialité, et en assure la sécurité et la sauvegarde.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Utilisation du service">
        <p>Il est interdit d&apos;utiliser {BRAND.name} pour :</p>
        <LegalList
          items={[
            "enregistrer des données sans rapport avec l'accompagnement des candidats, ou sans droit de le faire ;",
            "tenter d'accéder aux données d'une autre agence, contourner les limites ou perturber le service ;",
            "revendre ou mettre le service à disposition d'un tiers sans accord de l'éditeur.",
          ]}
        />
        <p>
          En cas de manquement grave, l&apos;éditeur peut suspendre le compte concerné, après
          avoir prévenu le patron sauf urgence.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilité et responsabilité">
        <LegalList
          items={[
            "L'éditeur fait de son mieux pour que le service soit disponible et fonctionne correctement, sans pouvoir garantir une disponibilité permanente (maintenance, panne d'un prestataire, coupure du réseau).",
            "Les données sont sauvegardées chaque nuit.",
            "Le service est un outil de suivi : les décisions des établissements, consulats et plateformes (Campus France, Études en France…) et le respect de leurs délais restent sous la responsabilité de l'agence et du candidat.",
            "La responsabilité de l'éditeur est limitée aux sommes payées par l'agence pour les douze derniers mois.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Résiliation">
        <p>
          L&apos;agence peut cesser d&apos;utiliser {BRAND.name} à tout moment, simplement en ne
          renouvelant pas son abonnement, et demander la suppression de ses données à{" "}
          <ContactLink /> : elles sont supprimées dans un délai de 30 jours, comme le décrit la{" "}
          <Link href="/confidentialite" className="text-link underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <p>
          Ces conditions peuvent évoluer. Les agences sont prévenues avant toute modification
          importante ; la version en vigueur est celle publiée sur cette page.
        </p>
      </LegalSection>

      <LegalSection title="11. Droit applicable et litiges">
        <p>
          Ces conditions sont soumises au droit algérien. En cas de désaccord, une solution
          amiable est recherchée d&apos;abord, en écrivant à <ContactLink />. À défaut, le litige
          est porté devant les juridictions algériennes compétentes.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

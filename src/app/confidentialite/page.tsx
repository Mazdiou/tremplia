import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { ContactLink, LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { UNCONFIRMED_DAYS } from "@/features/auth/schemas";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Données traitées par ${BRAND.name}, durées de conservation et droits des personnes.`,
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  const { editor } = LEGAL;
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="En bref">
        <LegalList
          items={[
            "Les données d'une agence ne sont visibles que par cette agence, et celles d'un candidat que par son agence et par lui-même.",
            "Aucune publicité, aucune revente, aucun traceur publicitaire ni mesure d'audience.",
            "Les mots de passe des plateformes (Études en France…) sont chiffrés, et chaque affichage est inscrit dans l'historique.",
            "Vous pouvez demander à consulter, corriger ou supprimer vos données.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Qui est responsable de vos données">
        <p>
          <strong>Comptes des agences et de leurs membres</strong> (patron, employés) :
          l&apos;éditeur de {BRAND.name}, {editor.name} (<ContactLink />), est
          responsable du traitement, au sens de la loi n° 18-07 du 10 juin 2018 relative à la
          protection des personnes physiques dans le traitement des données à caractère personnel.
        </p>
        <p>
          <strong>Données des candidats</strong> saisies par une agence : l&apos;agence en est
          responsable, c&apos;est elle qui les collecte auprès de ses candidats. {BRAND.name} les
          traite pour son compte, comme sous-traitant, uniquement pour lui fournir le service, et
          ne les utilise jamais à d&apos;autres fins.
        </p>
      </LegalSection>

      <LegalSection title="Données traitées">
        <LegalList
          items={[
            <>
              <strong>Agence</strong> : nom, ville, téléphone, réglages, abonnement et paiements
              faits à l&apos;éditeur.
            </>,
            <>
              <strong>Membres de l&apos;agence</strong> : prénom, nom, adresse e-mail, mot de passe
              (jamais gardé en clair), rôle et permissions, préférences (notifications, tableau
              de bord), historique des actions effectuées.
            </>,
            <>
              <strong>Candidats</strong> : identité, date de naissance, nationalité, ville,
              coordonnées (et celles d&apos;un proche, un parent par exemple, si l&apos;agence les
              saisit), niveau d&apos;études, filière et établissement actuels, diplômes, tests de
              langue, formations visées et réponses des établissements, documents (PDF), lettre de
              motivation et avis du candidat, identifiants de plateformes (chiffrés), code
              d&apos;accès à l&apos;espace candidat (chiffré), notes et tâches de l&apos;agence,
              paiements, messages échangés avec l&apos;agence.
            </>,
            <>
              <strong>Données techniques</strong> : pour limiter les essais de connexion,
              d&apos;inscription et les demandes d&apos;e-mail, adresse IP et adresse e-mail gardées
              seulement sous forme d&apos;empreinte illisible ; pour la sécurité des comptes des
              agences, le service de connexion (Supabase) enregistre l&apos;adresse IP et le
              navigateur de chaque session et un journal des connexions ; journaux techniques de
              l&apos;hébergeur ; rapports d&apos;erreurs, dont les données personnelles sont
              masquées avant l&apos;envoi ; pour les appareils où les notifications sont
              activées, l&apos;adresse d&apos;envoi donnée par le navigateur et ses clés de
              chiffrement.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Pourquoi">
        <LegalList
          items={[
            "Fournir le service à l'agence : suivi des dossiers, documents, échanges avec le candidat.",
            "Assurer la sécurité : connexion, limites d'essais, historique, détection des erreurs.",
            "Envoyer les e-mails du service : confirmation de l'adresse, mot de passe oublié, rappels de fin d'essai ou d'abonnement.",
            "Envoyer les notifications que chacun a activées sur ses appareils, selon ses choix.",
            "Gérer l'abonnement de l'agence.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Qui y a accès">
        <LegalList
          items={[
            "L'agence : son patron, et ses employés selon les permissions données par le patron.",
            "Le candidat, pour son seul dossier, avec le code d'accès que lui donne l'agence.",
            `L'éditeur, seulement pour l'assistance, la maintenance ou une obligation légale.`,
            "Les prestataires techniques ci-dessous, pour la seule partie du service qu'ils assurent.",
          ]}
        />
        <p>
          Le bouton WhatsApp d&apos;un dossier ouvre WhatsApp sur l&apos;appareil du membre, avec
          un message préparé : c&apos;est lui qui choisit de l&apos;envoyer. {BRAND.name} ne
          transmet rien à WhatsApp.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Les données sont hébergées hors d&apos;Algérie, chez les prestataires suivants :
        </p>
        <LegalList
          items={LEGAL.providers.map((p) => (
            <>
              <strong>{p.name}</strong> : {p.role}. Lieu : {p.place}.
            </>
          ))}
        />
        <p>Toutes les connexions sont chiffrées (HTTPS).</p>
        <p>
          Les notifications, si vous les activez, passent par le service de notification de
          votre navigateur (Google, Apple, Microsoft ou Mozilla selon l&apos;appareil). Leur contenu est
          chiffré pour votre appareil : ce service ne peut pas le lire.
        </p>
      </LegalSection>

      <LegalSection title="Combien de temps">
        <LegalList
          items={[
            "Comptes, dossiers et documents : tant que l'agence utilise le service. Après la fin d'un abonnement, ils restent consultables en lecture seule.",
            "Sur demande du patron de l'agence, toutes les données de l'agence sont supprimées dans un délai de 30 jours ; elles disparaissent ensuite des sauvegardes à mesure que celles-ci expirent (12 mois au plus).",
            `Inscription jamais confirmée : supprimée après ${UNCONFIRMED_DAYS} jours.`,
            "Empreintes d'adresses IP et d'adresses e-mail (limites d'essais) : 1 jour.",
            "Sessions de connexion : jusqu'à la déconnexion ou leur expiration ; journal des connexions : tant que le compte existe.",
            "Appareils abonnés aux notifications : jusqu'à leur désactivation ou la déconnexion, ou dès que le navigateur ne les accepte plus.",
            "Sauvegardes chiffrées : 30 jours pour les quotidiennes, 12 mois pour les mensuelles.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Sécurité">
        <LegalList
          items={[
            "Chaque agence est isolée des autres : la séparation est contrôlée par la base de données elle-même.",
            "Mots de passe des plateformes et codes des candidats chiffrés ; accès sensibles inscrits dans l'historique.",
            "Limites d'essais contre la recherche de mots de passe ou de codes.",
            "Sauvegarde chiffrée chaque nuit, avec une restauration vérifiée chaque mois.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies et stockage du navigateur">
        <p>
          {BRAND.name} n&apos;utilise que des cookies nécessaires à son fonctionnement : la session
          de connexion de l&apos;agence et celle de l&apos;espace candidat. Le navigateur garde
          aussi, sur l&apos;appareil seulement, quelques préférences (thème clair ou sombre,
          taille du texte, filtres, conseils masqués), l&apos;appareil activé pour les
          notifications et la page « Pas de connexion ». Aucun cookie publicitaire ni de mesure
          d&apos;audience : aucun consentement n&apos;est donc demandé.
        </p>
        <p>
          Sur ordinateur, un membre peut choisir un dossier où {BRAND.name} recopie les documents
          des dossiers en cours (Réglages › Sur cet ordinateur). Ces copies restent sur cet
          ordinateur, sous la responsabilité de l&apos;agence ; {BRAND.name} ne les envoie nulle
          part.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément à la loi n° 18-07, vous pouvez demander à être informé, à accéder à vos
          données, à les faire corriger ou supprimer, et vous opposer à leur traitement pour un
          motif légitime.
        </p>
        <LegalList
          items={[
            <>
              <strong>Agence ou membre d&apos;une agence</strong> : écrivez à <ContactLink />.
            </>,
            <>
              <strong>Candidat</strong> : adressez-vous d&apos;abord à votre agence, responsable de
              votre dossier. Vous pouvez aussi écrire à <ContactLink /> : la demande sera transmise
              à l&apos;agence.
            </>,
          ]}
        />
        <p>
          Vous pouvez aussi saisir l&apos;Autorité nationale de protection des données à caractère
          personnel (ANPDP).
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>
          Cette politique peut évoluer avec le service. La date de dernière mise à jour figure en
          haut de la page ; en cas de changement important, les agences sont prévenues.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

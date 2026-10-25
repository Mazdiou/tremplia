# Tremplia

CRM pour les agences qui accompagnent des candidats dans leurs démarches
d'études à l'étranger (Campus France et autres). Chaque agence travaille dans
un espace isolé : ses campagnes, ses dossiers candidats, son équipe. Les
candidats suivent leur dossier dans un espace à part, avec un simple code.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Pile technique](#pile-technique)
3. [Démarrer en local](#démarrer-en-local)
4. [Variables d'environnement](#variables-denvironnement)
5. [Vérifications et CI](#vérifications-et-ci)
6. [Architecture](#architecture)
7. [Structure du dépôt](#structure-du-dépôt)
8. [Conventions de code](#conventions-de-code)
9. [Règles de sécurité et de données](#règles-de-sécurité-et-de-données)
10. [Base de données](#base-de-données)
11. [Déploiement](#déploiement)
12. [Sauvegardes](#sauvegardes)
13. [Abonnements et administration](#abonnements-et-administration)
14. [E-mails](#e-mails)
15. [Notifications](#notifications)
16. [Pages légales](#pages-légales)
17. [Application installable (PWA)](#application-installable-pwa)
18. [Nom et couleurs](#nom-et-couleurs)
19. [Ajouter un modèle de campagne](#ajouter-un-modèle-de-campagne)
20. [Glossaire](#glossaire)

---

## Fonctionnalités

### Pour l'agence (patron et employés)

| Domaine | Ce qu'on y fait |
|---|---|
| **Campagnes** | Une campagne par procédure et par année (ex. Campus France 2026-2027), créée de zéro ou importée d'un modèle. Elle porte ses groupes (DAP, Hors-DAP, École…), ses étapes (parcours propre à la campagne), ses dates clés, ses informations utiles et ses plateformes suggérées. Archivable, réactivable. |
| **Dossiers** | Un dossier par candidat : identité, contact, niveau, diplômes, tests de langue, groupes, étape, statut (actif, clos, abandonné). Rangés dans un arbre par campagne et par groupe, avec recherche (Ctrl+K). Shift+N (hors saisie) ouvre un nouveau dossier dans la campagne en cours. Un nouveau dossier peut être prérempli à partir d'un candidat déjà suivi dans une autre campagne. Mode sélection de l'arbre : même étape, même responsable (patron) ou même tâche pour plusieurs dossiers d'un coup. |
| **Documents** | PDF (10 Mo au plus) classés en dossiers, déplaçables par glisser-déposer, verrouillables par le patron, téléchargeables en une archive ZIP. |
| **Comptes externes** | Identifiants du candidat sur les plateformes (Études en France, etc.). Mots de passe chiffrés, chaque affichage est journalisé. |
| **Lettre de motivation** | Rédigée dans le dossier, soumise à l'avis du candidat. |
| **Formations** | Formations visées, ordonnées, avec la réponse de l'établissement (sans réponse, envoyée, acceptée, liste d'attente, refusée). Soumises à l'avis du candidat. |
| **Notes** | Notes internes de l'équipe sur le dossier. |
| **Tâches** | Ce qu'il reste à faire pour un candidat : intitulé, échéance facultative, membre chargé de la tâche. Onglet dans le dossier (ajout aussi depuis le menu ⋯ de l'en-tête), page « Tâches » (les miennes, celles de l'équipe ou d'un membre, rangées par échéance), pastille dans le menu, bloc du tableau de bord, horloge et filtre dans l'arbre. Créer : tout membre ; modifier ou cocher : l'auteur, le responsable ou le patron ; supprimer : l'auteur ou le patron. À la clôture du dossier, ses tâches peuvent être marquées faites. Jamais visibles du candidat. |
| **Paiements** | Montant convenu et paiements du candidat à l'agence, en dinars (espèces, CCP / BaridiMob, carte CIB / Edahabia). Un paiement s'annule, il ne se supprime pas. |
| **Messages** | Une conversation par dossier avec le candidat, en temps réel, avec pastilles de non-lus (dossier, arbre, tableau de bord). |
| **WhatsApp** | Ouvre une conversation WhatsApp avec le candidat (ou son parent), avec des messages préparés : lien de l'espace candidat, nouveau message, reste à payer, passage à l'agence. |
| **Historique** | Journal de tout ce qui a été fait sur le dossier, et par qui. |
| **Tableau de bord** | Widgets, dans l'ordre par défaut : « À traiter », mes tâches, dossiers sans nouvelles (aucune action de l'agence depuis 14 jours), retards de l'équipe, chiffres clés, avancement des dossiers ou campagnes, prochaines échéances, réponses des formations, paiements, encaissements par mois, activité de l'équipe ; toutes les campagnes actives ou une seule. « Personnaliser » : chaque membre choisit ses widgets, leur ordre (glisser-déposer ou flèches) et leur taille (demi ou pleine largeur) ; le patron peut proposer sa disposition à toute l'équipe, puis la retirer. Paiements et encaissements : patron ou droit « Voir la caisse » ; retards et activité de l'équipe : patron. |
| **Export Excel** | Classeur complet d'une campagne (patron). |
| **Copie sur l'ordinateur** | Chrome et Edge sur ordinateur : chaque membre choisit un dossier (Réglages › Sur cet ordinateur) où Tremplia recopie les PDF des dossiers en cours, rangés comme l'arbre (campagne / groupe ou « Non classés » / NOM Prénom / dossier de documents), pour les déposer facilement sur les plateformes. Mise à jour à l'ouverture de Tremplia, dès qu'un document change dans un dossier ouvert, ou avec un bouton (Réglages, onglet Documents). Tremplia ne touche qu'aux fichiers qu'il a copiés (liste cachée `.tremplia-copie.json`). |
| **Notifications** | Sur le téléphone ou l'ordinateur, même Tremplia fermé : chaque membre les active sur chacun de ses appareils et choisit pour lui-même (Réglages › Notifications) : messages des candidats et réponses sur la lettre et les formations (dossiers dont il est responsable ; patron : aussi ceux sans responsable actif), tâche confiée par un collègue, tâches du jour chaque matin. Voir [Notifications](#notifications). |
| **Réglages** | Mon compte, mot de passe, apparence (thème clair ou sombre, retenu sur l'appareil ; c'est là qu'il se change sur téléphone), notifications, copie sur l'ordinateur ; pour le patron, l'agence, les valeurs des nouvelles campagnes, le guide de démarrage et l'abonnement. |
| **Guide de démarrage** | Mot de bienvenue à la première connexion de chaque membre, puis, pour le patron d'une nouvelle agence, la liste « Bien démarrer » en haut du tableau de bord : six étapes (campagne, dossier, document, espace candidat, tâche, employé) qui se cochent d'après les vraies données et mènent chacune au bon écran. Masquable (pour toute l'agence), réaffichable dans les réglages. Les agences déjà inscrites ne le voient pas. |
| **Équipe** | Le patron ajoute ses employés (mot de passe temporaire à remplacer à la première connexion), leur donne un nouveau mot de passe temporaire s'ils ont oublié le leur (l'ancien cesse de marcher, leurs sessions sont fermées), les désactive ou les supprime. |
| **Compte** | Inscription d'une agence confirmée par e-mail (compte fermé avant le clic sur le lien), mot de passe oublié (lien reçu par e-mail), rappels de fin d'essai ou d'abonnement 7 jours et 1 jour avant. Voir [E-mails](#e-mails). |

**Patron / employé.** Les employés travaillent sur les dossiers. Sont réservés
au patron : créer, régler, archiver et exporter une campagne ; gérer l'équipe ;
verrouiller un document ; les actions sensibles vérifiées par les fonctions
SQL.

### Pour le candidat (`/student`)

Connexion avec le code de son dossier, donné par l'agence (sans compte). Le
candidat consulte ses informations, valide ou demande une modification de sa
lettre et de ses formations, et échange avec l'agence par messages. Il peut
être prévenu des messages de l'agence sur son téléphone (bouton en haut de
ses messages).

### Pour l'administrateur de la plateforme (`/admin`)

Liste des agences, enregistrement des paiements d'abonnement, annulation
d'un paiement saisi par erreur, et suppression définitive d'une agence.

---

## Pile technique

| Couche | Outils |
|---|---|
| Application | Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript |
| Interface | Tailwind CSS 4, shadcn/ui (base-ui), lucide-react |
| Validation | zod 4, schémas partagés entre formulaires et routes |
| Données | Supabase : PostgreSQL, Auth, Storage, Realtime, RLS |
| Fichiers | fflate (archives ZIP et classeurs Excel construits à la main) |
| Tests | Vitest (unitaires), pgTAP (base), Playwright (bout en bout) |
| Hébergement | Vercel (région `arn1`) + Supabase (`eu-north-1`) |

---

## Démarrer en local

Prérequis : Node.js 22, Docker (pour la base Supabase locale).

```powershell
npm ci
copy .env.example .env.local   # puis remplir les valeurs (voir ci-dessous)
npx supabase start             # base locale
npx supabase status -o env     # affiche l'URL et les clés à copier dans .env.local
npx supabase db reset          # applique toutes les migrations (efface la base locale)
npm run dev
```

Ouvrez ensuite http://localhost:3000/register pour créer une agence ; le
compte créé est celui du patron.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Génère les types des routes Next puis lance `tsc` |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Tests Vitest |
| `npx supabase test db` | Tests pgTAP sur la base locale démarrée |
| `npm run test:e2e` | Tests de bout en bout (Playwright), après `npm run build` |

---

## Variables d'environnement

Modèle : `.env.example`. Aucune vraie valeur ne doit être commitée
(`.env*` est ignoré par git, sauf l'exemple).

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique : le navigateur ne lit qu'à travers le RLS |
| `SUPABASE_SECRET_KEY` | Clé secrète, utilisée par le serveur uniquement |
| `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY` | 32 octets en base64. Chiffre les mots de passe des comptes externes et les codes candidats, signe les sessions candidat. **À sauvegarder hors du dépôt** : la perdre rend ces données illisibles |
| `SUPPORT_PHONE` | Facultatif. Numéro affiché aux agences pour renouveler leur abonnement ; sans lui, « contactez-nous » |
| `NEXT_PUBLIC_SENTRY_DSN` | Facultatif. Adresse d'envoi du suivi des erreurs (Sentry). À définir **seulement en production**, avant le build (elle est intégrée au code du navigateur) ; sans elle, rien n'est envoyé. Pas secrète. Lue dans `src/lib/sentry.ts` |
| `SITE_URL` | Facultatif. Adresse publique du site, pour les liens des e-mails, les aperçus de liens et le plan du site. Par défaut `https://www.tremplia.com` (`src/config/brand.ts`) ; en local `http://127.0.0.1:3000`. Jamais déduite de la requête |
| `RESEND_API_KEY` | Production. Clé Resend (« Sending access », domaine `tremplia.com`) : envoi des e-mails de l'application. Secrète. Sans elle, en production, aucun e-mail ne part (erreur signalée à Sentry) |
| `MAILPIT_URL` | Local et CI. Boîte de test du Supabase local (`http://127.0.0.1:54324`) : sans clé Resend, les e-mails y arrivent. Sans l'une ni l'autre, hors production, ils sont écrits dans la console |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Clés des notifications (Web Push), créées une fois avec `npx web-push generate-vapid-keys`. La publique est donnée aux navigateurs, la privée est secrète. Sans elles, les notifications ne sont pas proposées. Les changer oblige chacun à les réactiver |
| `CRON_SECRET` | Production. Secret des tâches planifiées (`/api/cron/…`) : le même dans Vercel et dans les secrets GitHub. Sans lui, ces routes refusent tout |
| `CLIENT_IP_HEADER` | Facultatif. En-tête qui porte l'IP du visiteur, pour les limites d'essais. Par défaut `x-forwarded-for` (dernière adresse) : correct sur Vercel et derrière nginx ; derrière Cloudflare, `cf-connecting-ip` |

Générer la clé de chiffrement :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Les variables sont lues et validées dans `src/lib/env.ts` (publiques) et
`src/lib/env-server.ts` (serveur).

---

## Vérifications et CI

À lancer avant chaque push (`.github/workflows/ci.yml` fait la même chose à
chaque push et pull request) :

```powershell
npm run typecheck
npx eslint src
npm test
npm run build
npx supabase test db
npm run test:e2e
```

La CI a trois tâches :

- **verifier** : types, lint, tests Vitest et build, avec des variables
  factices (le build n'a besoin d'aucun secret) ;
- **base** : démarre un Supabase local et lance les tests pgTAP (migrations,
  droits, RLS, règles patron / employé) ;
- **bout-en-bout** : démarre un Supabase local, construit l'application et
  la parcourt dans Chromium avec Playwright. En cas d'échec, le rapport et
  les traces sont joints à l'exécution (« rapport-playwright »).

### Tests de bout en bout (`e2e/`)

`e2e/parcours.spec.ts` rejoue le parcours principal, chaque étape partant
de la précédente : redirection d'un visiteur vers la connexion, inscription
d'une agence, connexion refusée tant que l'adresse n'est pas confirmée, lien
de confirmation reçu par e-mail (Mailpit, `e2e/mailpit.ts`), import du modèle Campus France, création
d'un dossier avec un premier paiement, envoi d'un PDF, ouverture de l'espace
candidat, connexion du candidat et message reçu par l'agence, refus d'un
mauvais code, et pour finir mot de passe oublié (lien reçu, nouveau mot de
passe, lien inutilisable une seconde fois).

En local : Supabase local démarré, `.env.local` pointé dessus (avec
`MAILPIT_URL=http://127.0.0.1:54324`), puis
`npm run build` et `npm run test:e2e`. L'application tourne sur le port 3100
(le 3000 reste à `npm run dev`). Chaque lancement crée sa propre agence
(e-mail unique) sans rien effacer, et se présente avec une adresse IP
différente pour ne pas buter sur la limite de 3 inscriptions par heure.
Première fois : `npx playwright install chromium`.

---

## Architecture

### Parcours d'une requête

```
Navigateur
   │
   ├─ proxy.ts ─────────── session Supabase renouvelée ; redirections
   │                       (non connecté → /login, connecté → /dashboard,
   │                        mot de passe temporaire → /change-password)
   │
   ├─ Pages (composants serveur)
   │     requireMember() → lectures dans features/*/server
   │
   ├─ Composants client
   │     lectures directes via le RLS (clé publique)
   │     écritures → callApi() → routes API
   │
   └─ Routes API (app/api/**/route.ts, minces)
         safely() → contrôle d'accès → parseBody()/parseId()
         → fonction de features/*/server → fonction SQL ou table
```

### Contrôle d'accès

- `src/lib/auth/require-member.ts` : `requireMember()` renvoie le membre
  **actif** connecté (agence, rôle, nom), mis en cache pour la durée d'un
  affichage. `requireOwner()`, `requireApiMember()` et `requireApiOwner()` en
  dérivent. L'agence vient toujours de la session, jamais de la requête.
- `src/features/cases/server/authorize-case.ts` : `authorizeCase(id)` vérifie
  qu'un dossier appartient à l'agence du membre avant toute action dessus.
- `src/features/student/server/session.ts` : session du candidat (cookie
  signé `sf_student`, 7 jours), revérifiée à chaque affichage ;
  `requireApiStudent()` pour ses routes. Le proxy ne touche pas aux chemins
  `/student` et `/api/student`.
- La base revérifie tout : RLS sur chaque table, et fonctions SQL pour les
  écritures qui dépendent du rôle.

### Erreurs (`src/lib/api-errors.ts`)

- `ApiError(status, message)` : erreur prévue, au message français prêt à
  afficher.
- `safely(label, run)` : enveloppe chaque route ; une `ApiError` devient sa
  réponse JSON, toute autre exception une 500, signalée au suivi des
  erreurs. Seul le nom de l'erreur est écrit dans les logs.
- `dbError(label, error, messages?)` : traduit un code d'erreur PostgreSQL
  (droits, doublon, campagne archivée, document verrouillé, abonnement
  expiré…) en `ApiError`.
- `rateLimited(error, message)` : limite d'essais atteinte → 429.
- Toutes les réponses sont envoyées en `Cache-Control: no-store`.

Côté navigateur, `src/lib/api-client.ts` (`callApi`, `callApiError`) appelle
les routes et renvoie un message prêt à afficher, y compris en cas de coupure
réseau.

### Suivi des erreurs (Sentry)

- Actif seulement si `NEXT_PUBLIC_SENTRY_DSN` est défini (la production).
  Démarrage : `src/instrumentation.ts` (serveur, edge, avec
  `onRequestError` pour toute erreur non rattrapée d'une page ou d'une
  route) et `src/instrumentation-client.ts` (navigateur).
- Côté serveur, les anomalies passent par `reportError(label, code)` et
  `reportException(label, e)` (`src/lib/report-error.ts`) : écrites dans
  les logs **et** signalées. Ne pas écrire `console.error` directement.
- Une page en erreur affiche `app/error.tsx` (« Une erreur est survenue »,
  bouton « Réessayer ») et la signale ; `app/global-error.tsx` couvre une
  erreur de la mise en page racine.
- **Aucune donnée personnelle** : ni utilisateur, ni adresse IP, ni cookies,
  en-têtes, corps ou paramètres de requête ; e-mails et numéros de
  téléphone masqués dans les messages (`scrubEvent`, testé). Pas
  d'enregistrement de session ni de mesure des performances.
- **Tunnel.** Le navigateur envoie ses rapports à `/api/rapport` (même
  site), que le serveur transmet à Sentry : les bloqueurs de publicité
  arrêtent les requêtes vers `sentry.io`. Seulement pour le projet de
  `NEXT_PUBLIC_SENTRY_DSN` (adresse construite côté serveur, jamais lue dans
  la requête), 256 Ko au plus, rien dans les logs (`src/lib/sentry-tunnel.ts`,
  testé). Sans DSN, la route refuse tout.
- Pas encore de « source maps » : les traces du navigateur pointent vers le
  code compilé. Elles demanderaient un jeton Sentry dans le build.

### Temps réel

`src/components/live-refresh.tsx` s'abonne (Supabase Realtime, filtré par le
RLS) aux nouveaux messages des candidats, à leurs avis et aux tâches de
l'agence, et rafraîchit la page. Une interrogation régulière prend le relais
si la connexion tombe. Une tâche supprimée n'est pas diffusée (Supabase ne
filtre pas les suppressions) : elle disparaît à la relecture suivante.

---

## Structure du dépôt

```
src/
  proxy.ts              session et redirections (ex-middleware)
  app/
    (app)/              pages de l'agence avec la coquille : dashboard,
                        tasks, campaigns, team, settings, admin
    cases/              arbre des dossiers et pages d'un dossier (un onglet
                        par page : infos, documents, lettre, formations,
                        notes, tâches, paiements, messages, historique)
    student/            espace candidat (login, puis (space)/…)
    api/                routes API, minces (une action par fichier)
    auth/confirm        lien reçu par e-mail (confirmation, mot de passe)
    login, register, forgot-password, reset-password, change-password,
    offline, manifest, icônes, robots, sitemap, opengraph-image…
  components/
    ui/                 composants shadcn (button, input, label)
    shell/              coquille de l'application (rail, en-tête)
    auth/               pages de connexion et d'inscription
    page-ui.tsx         briques de page (titres, menus, StatusMessage…)
    form-fields.tsx     champs de formulaire et erreurs
    confirm-dialog, empty-state, live-refresh, theme-toggle…
  hooks/                use-dismiss (fermer un menu), use-modal-dialog,
                        use-browser-value
  config/
    brand.ts            nom, accroche, adresse, e-mails, couleurs
    legal.ts            éditeur, prestataires, liens des pages légales
    campaign-templates/ modèles de campagne (un fichier par modèle)
  features/<domaine>/
    components/         composants React du domaine
    server/             lectures et écritures serveur (import "server-only")
    schemas.ts          schémas zod partagés formulaires / routes
    labels.ts           listes métier et libellés français
    *.ts                logique pure, testée par Vitest (*.test.ts à côté)
  lib/
    supabase/           clients (server, client, admin) et readAll
    auth/               requireMember et dérivés
    audit/              journal d'activité
    crypto/             chiffrement et signatures
    email/              envoi (Resend, Mailpit) et modèles des e-mails
    api-errors, api-client, env, env-server, client-ip, site-url,
    cron-auth, validation,
    dates, money, names, plural, phone, save-file, ui-prefs, xlsx, utils
supabase/
  migrations/           une migration par domaine, dans l'ordre
  tests/                un fichier pgTAP par domaine
  templates/            e-mails envoyés par Supabase lui-même (générés)
  config.toml           configuration du Supabase local
test/                   doublure de "server-only" pour Vitest
e2e/                    tests de bout en bout (Playwright)
scripts/backup/         sauvegarde chiffrée et restauration
```

Domaines de `features/` : `admin`, `agency`, `auth`, `campaigns`, `cases`,
`dashboard`, `documents`, `export`, `history`, `landing`, `local-copy`, `messages`,
`motivation-letter`, `notes`, `notifications`, `payments`, `programs`, `pwa`, `settings`,
`stages`, `student`, `subscription`, `tasks`, `team`, `whatsapp`.

---

## Conventions de code

- **Code en anglais, interface en français.** Les commentaires sont en
  français et expliquent le *pourquoi*, pas le *quoi*.
- **Routes minces.** Une route ne fait que : `safely` → contrôle d'accès →
  validation → appel d'une fonction de `features/*/server` → `ok(...)`.
  Exemple (`src/app/api/cases/[id]/notes/route.ts`) :

  ```ts
  export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return safely("notes create", async () => {
      const { id } = await params;
      const auth = await authorizeCase(id);
      const { content } = await parseBody(request, noteSchema);
      return ok({ id: await createNote(auth, id, content) }, 201);
    });
  }
  ```

- **Une seule source de vérité.** Les listes métier et leurs libellés vivent
  dans `features/*/labels.ts` (ou `schemas.ts`) ; les limites (nombre de
  groupes, taille d'un PDF…) sont des constantes partagées par le formulaire,
  la route et, en SQL, la base.
- **Validation.** Schémas zod dans `features/*/schemas.ts`, construits avec
  les briques de `src/lib/validation.ts` (`requiredText`, `optionalText`,
  `uuidSchema`, `isUuid`…).
- **Utilitaires à réutiliser** plutôt que recopier :

  | Besoin | Utilitaire |
  |---|---|
  | Pluriel (« 3 dossiers ») | `plural`, `pluralWord` (`lib/plural`) |
  | Nom d'un membre / d'un candidat | `fullName` (« Prénom Nom »), `displayName` (« NOM Prénom ») (`lib/names`) |
  | Noms de plusieurs membres | `memberNames` (`features/team/server/members`) |
  | Dates, montants | `lib/dates`, `lib/money` |
  | Lien `tel:` | `telHref` (`lib/phone`) |
  | Lire plus de 1000 lignes | `readAll` (`lib/supabase/read-all`) |
  | Enregistrer un fichier généré | `saveFile` (`lib/save-file`) |
  | Fermer un menu (Échap, clic dehors) | `useDismiss` (`hooks/`) |
  | Fenêtre modale native | `useModalDialog` (`hooks/`) |
  | Message de réussite / d'erreur | `StatusMessage`, `ActionMessage` (`components/page-ui`) |
  | Journal d'activité | `logActivity` (`lib/audit`) |

- **Code mort.** Rien d'exporté sans utilisateur ; les variantes de
  composants inutilisées sont retirées.

---

## Règles de sécurité et de données

- **Isolation stricte entre agences**, garantie par la base (RLS et clés
  composites agence + campagne), pas seulement par les routes.
- **Le navigateur lit via le RLS ; il n'écrit jamais.** Les écritures passent
  par les routes serveur. Seule exception : l'envoi d'un PDF va directement au
  stockage, avec une URL signée préparée par le serveur (limite de taille des
  requêtes sur Vercel).
- **Le serveur n'a que les droits nécessaires**, table par table. Dès qu'une
  règle dépend de l'acteur ou de son rôle (patron / employé), l'écriture passe
  par une fonction SQL qui le vérifie. Un test pgTAP fige la liste exacte des
  droits (`supabase/tests/core_test.sql`).
- **Rien n'est supprimé de ce qui fait l'historique** : un dossier jamais (il
  est clos ou abandonné), un paiement est annulé, un employé qui a créé
  quelque chose est désactivé, pas supprimé.
- **Aucune donnée personnelle** dans une URL, un journal technique
  (`console.*`), un message d'erreur ou le journal d'activité. Les recherches
  par identité passent en POST.
- **Mots de passe des comptes externes** chiffrés par le serveur, illisibles
  côté client ; chaque affichage est inscrit au journal avant d'être renvoyé.
- **Espace candidat** : la base ne garde que l'empreinte du code et une copie
  chiffrée ; un nouveau code, un accès fermé ou un dossier abandonné
  invalident la session. Lecture seule, filtrée sur le dossier de la session.
  Toute modification de la lettre ou des formations par l'agence redemande
  l'avis du candidat.
- **Limites d'essais** (en base, par adresse IP) : connexion candidat
  (10 échecs sur 15 minutes), inscription d'agence, messages du candidat.
- **Abonnement expiré** : la base refuse toute écriture de l'agence (lecture
  seule).

---

## Base de données

Les migrations (`supabase/migrations/`) sont découpées par domaine :

| Migration | Contenu |
|---|---|
| `core` | agences, profils, rôles, droits de base |
| `campaigns` | campagnes, groupes, dates, informations |
| `cases` | dossiers, diplômes, tests, comptes externes |
| `activity_log` | journal d'activité |
| `documents` | dossiers de documents, PDF, verrouillage, stockage |
| `case_notes` | notes |
| `motivation_letters` | lettres de motivation |
| `case_programs`, `case_program_results` | formations et réponses des établissements |
| `student_access`, `student_review` | codes candidats, sessions, avis du candidat |
| `case_messages`, `realtime_messages` | messages et leur publication en temps réel |
| `case_stats` | compteurs pour l'arbre et le tableau de bord |
| `case_payments`, `case_payment_totals`, `payment_methods` | paiements et totaux |
| `rate_limits` | limites d'essais |
| `subscriptions`, `admin_agency_exempt` | abonnements, administrateurs |
| `case_stages` | étapes des campagnes |
| `bulk_case_actions` | actions groupées (étape, responsable) |
| `agency_settings` | réglages de l'agence et valeurs des nouvelles campagnes |
| `case_tasks`, `case_close_tasks` | tâches des dossiers, actions groupées, clôture avec tâches, temps réel des tâches (suppressions comprises) |
| `onboarding` | guide de démarrage : avancement, guide masqué, mot de bienvenue vu |
| `gift_months` | mois d'abonnement offerts par l'administrateur |
| `employee_permissions` | permissions des employés (caisse, campagnes…) |
| `emails` | limites des e-mails demandés (mot de passe oublié, confirmation), compte lié à une adresse, rappels d'abonnement |
| `purge_unconfirmed` | suppression des inscriptions jamais confirmées (7 jours) |
| `delete_agency` | suppression d'une agence par l'administrateur, exception `is_purging()` des règles de protection |
| `push_notifications` | appareils abonnés aux notifications, choix de chaque membre, destinataires de chaque événement, récapitulatif du matin |
| `dashboard_layouts` | disposition du tableau de bord de chaque membre et celle de l'agence |
| `case_last_activity` | date de la dernière action de l'agence sur chaque dossier (« Dossiers sans nouvelles ») |

Chaque domaine a son fichier de tests pgTAP dans `supabase/tests/`.

**Ajouter une migration** : `npx supabase migration new <nom>`, l'écrire,
la tester avec `npx supabase db reset` puis `npx supabase test db`, ajouter
ses tests pgTAP (et mettre à jour `core_test.sql` si des droits changent).
Elle doit ensuite être appliquée sur la base en ligne **avant** de déployer
le code qui en dépend.

---

## Déploiement

- **Vercel** déploie automatiquement la branche `main`. Les variables
  d'environnement sont réglées dans le projet Vercel.
- **Région.** Les fonctions Vercel tournent dans la région fixée par
  `vercel.json` (`arn1`, Stockholm), la même que la base Supabase
  (`eu-north-1`). Chaque page fait plusieurs allers-retours vers la base :
  ~2 ms dans la même région, ~100 ms d'un continent à l'autre. Si la base
  change de région, changer `regions` en conséquence (`eu-central-1` →
  `fra1`, `eu-west-3` → `cdg1`, `eu-west-2` → `lhr1`, `us-east-1` → `iad1`).
- **Supabase en ligne.** Les inscriptions directes à Supabase Auth sont
  désactivées : les comptes sont créés par le serveur (`/api/auth/register`,
  ajout d'un employé). Authentication › URL Configuration : Site URL
  `https://www.tremplia.com`, Redirect URLs `https://www.tremplia.com/**`.
- **Domaine.** `tremplia.com`, DNS chez Hostarts : `A @` et `CNAME www` vers
  Vercel (adresse principale `www.tremplia.com`, `tremplia.com` y redirige),
  enregistrements Resend (`resend._domainkey`, `send`, `rsend`, `_dmarc`).
  Changer d'hébergeur = changer le `A` et le `CNAME`.

---

## Sauvegardes

Supabase ne sauvegarde rien en plan gratuit, et en Pro ses sauvegardes
n'incluent pas les fichiers du stockage. Une sauvegarde indépendante tourne
donc chaque nuit (`.github/workflows/sauvegarde.yml`, 3 h à Alger) :

1. `scripts/backup/backup.sh` copie la base (schéma, données, comptes,
   historique des migrations) et tous les fichiers du stockage ;
2. l'ensemble est chiffré avec [age](https://age-encryption.org) pour une clé
   publique : seule la clé privée correspondante, gardée **hors ligne**, peut
   l'ouvrir ;
3. l'archive part sur Backblaze B2 (10 Go gratuits, sans carte bancaire ;
   tout stockage compatible S3 convient) : `quotidien/AAAA-MM-JJ.tar.gz.age`, et le
   1er du mois aussi `mensuel/AAAA-MM.tar.gz.age` ;
4. le 1er du mois (ou à la demande), la tâche restaure l'archive dans un
   Supabase local vide et vérifie chaque table, ligne pour ligne.

GitHub envoie un e-mail si la tâche échoue. Pour la lancer à la main :
onglet Actions → Sauvegarde → Run workflow.

### Mise en place (une fois)

1. **Clés age.** `age-keygen -o cle-privee-sauvegarde.txt` (age : `winget
   install FiloSottile.age` sur Windows). Ranger ce fichier en lieu sûr
   (gestionnaire de mots de passe + clé USB), **jamais dans le dépôt**. La
   ligne `# public key: age1…` donne la clé publique.
2. **Backblaze B2.** Créer un bucket **privé** (chiffrement par défaut
   activé), noter son adresse S3 (« Endpoint », `s3.<région>.backblazeb2.com`).
   Dans Lifecycle Settings, règles personnalisées : préfixe `quotidien/`
   masqué après 30 jours, `mensuel/` après 365 jours, puis supprimés 1 jour
   après. Dans Application Keys, créer une clé limitée à ce bucket
   (lecture et écriture).
3. **Secrets GitHub** (Settings → Secrets and variables → Actions) :

   | Secret | Valeur |
   |---|---|
   | `SUPABASE_DB_URL` | Supabase → Connect → **Session pooler** (URI avec le mot de passe de la base, caractères spéciaux encodés : `@` → `%40`…) |
   | `SUPABASE_URL` | Adresse du projet (`https://….supabase.co`) |
   | `SUPABASE_SECRET_KEY` | Clé secrète du projet |
   | `BACKUP_AGE_RECIPIENT` | Clé publique age (`age1…`) |
   | `BACKUP_S3_ENDPOINT` | Adresse S3 du bucket, avec `https://` |
   | `BACKUP_BUCKET` | Nom du bucket |
   | `BACKUP_S3_KEY_ID` / `BACKUP_S3_SECRET_KEY` | Clé d'application B2 (keyID / applicationKey) |

4. Lancer la tâche à la main avec « Vérifier aussi la restauration » coché.

À garder aussi hors ligne : `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`. Sans elle,
une base restaurée a des mots de passe externes et des codes candidats
illisibles.

### Restaurer

Dans un projet Supabase **neuf** (aucune migration appliquée) :

```bash
# Archive téléchargée depuis le bucket ; psql, age et Node nécessaires
# (sans psql : PSQL="docker run --rm -i postgres:17 psql")
SUPABASE_DB_URL="…" SUPABASE_URL="https://….supabase.co" SUPABASE_SECRET_KEY="…" \
  scripts/backup/restore.sh 2026-10-17.tar.gz.age cle-privee-sauvegarde.txt
```

Le script charge la base en une seule transaction (rien n'est écrit en cas
d'erreur), vérifie que chaque table a autant de lignes que dans la
sauvegarde, puis renvoie les fichiers. Il reste à faire pointer Vercel sur le
nouveau projet (variables d'environnement) et à y désactiver les inscriptions
directes, comme sur l'ancien.

---

## Abonnements et administration

Chaque agence a 7 jours d'essai, puis un abonnement payé (espèces, CCP ou
BaridiMob) que l'administrateur de la plateforme enregistre dans `/admin`
(« Paiement reçu » : 1, 3 ou 12 mois). « Offrir des mois » prolonge
l'abonnement sans paiement, avec un motif : la ligne apparaît « Offert »
dans l'historique et s'annule comme un paiement. Des bandeaux préviennent l'agence
avant la fin. Après la date de fin, l'agence est en lecture seule : la base
refuse toute écriture sur ses données.

L'administrateur se désigne à la main, une seule fois, dans l'éditeur SQL de
Supabase. Son compte doit aussi être celui d'une agence (la sienne), qui est
exemptée d'abonnement :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'votre-email@exemple.com';
```

Pour retirer ce droit : `delete from public.platform_admins where user_id = '…';`.

**Supprimer une agence** (fiche de l'agence dans `/admin`, nom retapé pour
confirmer) : la fonction SQL `delete_agency` (migration `delete_agency`)
supprime d'un coup l'agence, tout ce qui lui est rattaché (campagnes,
dossiers, documents même verrouillés, paiements, messages, historique…) et
les comptes de connexion de ses membres ; le serveur efface ensuite ses
fichiers du stockage (`<agence>/…`, envois jamais confirmés compris). Les
règles de protection habituelles (lecture seule, verrouillage, campagne
archivée, patron non supprimable) laissent passer cette seule suppression
(`is_purging()`). Jamais l'agence de l'administrateur. Les données restent
dans les sauvegardes jusqu'à leur expiration (12 mois au plus).

---

## E-mails

Les e-mails de l'application partent par **Resend** (`src/lib/email/send.ts`),
depuis `noreply@tremplia.com`, réponse vers `contact@tremplia.com`
(`src/config/brand.ts`). Une seule mise en page, HTML et texte, dans
`src/lib/email/templates.ts`.

| E-mail | Quand | Code |
|---|---|---|
| Confirmation de l'adresse | Inscription d'une agence ; « Renvoyer » sur la connexion et la fin de l'inscription | `src/features/auth/server/emails.ts` |
| Mot de passe oublié | `/forgot-password` | idem |
| Rappel de fin d'essai ou d'abonnement | 7 jours puis 1 jour avant, chaque matin à 8 h (`.github/workflows/taches-quotidiennes.yml` → `/api/cron/subscription-reminders`) | `src/features/subscription/server/reminders.ts` |

**Liens.** Les jetons viennent de Supabase Auth (`generateLink`, un seul
usage, 1 heure). Le lien mène à `/auth/confirm`, qui ne vérifie le jeton
qu'au clic sur un bouton (les messageries qui ouvrent les liens pour les
analyser ne le consomment pas). Il est construit sur `SITE_URL`, jamais sur
l'hôte de la requête. `/reset-password` n'accepte qu'une session ouverte
par un lien depuis moins d'une heure (`src/features/auth/link-session.ts`).

**Limites** (migration `emails`) : mot de passe oublié et renvoi de
confirmation, 5 demandes par heure et par adresse IP (429), 50 par heure pour
tout le service, 3 par heure et par adresse e-mail (au-delà, même réponse
mais rien n'est envoyé). La réponse est la même que le compte existe ou non ;
un employé désactivé ne reçoit rien. Les rappels sont réservés dans la base
avant l'envoi (`subscription_reminders`) : jamais deux fois le même, libérés
si l'envoi échoue. Pas de rappel à 7 jours pour une agence inscrite depuis
moins de 2 jours, ni pour l'agence de l'administrateur.

**Inscriptions jamais confirmées** : chaque matin, la même tâche supprime
celles de plus de 7 jours (`/api/cron/purge-unconfirmed`, migration
`purge_unconfirmed`) : compte et agence, seulement si l'agence est restée
vide (aucun autre membre, campagne, dossier ni paiement d'abonnement) et
jamais un administrateur. L'adresse e-mail redevient libre.

**En local**, les e-mails arrivent dans Mailpit (`MAILPIT_URL`) :
<http://127.0.0.1:54324>.

### Mise en place en production (une fois)

1. **Resend** : domaine `tremplia.com` vérifié (région Irlande). API Keys ›
   Create : « Sending access », domaine `tremplia.com`.
2. **Vercel** (Production) : `RESEND_API_KEY` = cette clé ; `CRON_SECRET` =
   une valeur aléatoire
   (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
   Puis redéployer.
3. **GitHub** (Settings › Secrets and variables › Actions) : `CRON_SECRET`,
   la même valeur. Sans ce secret, la tâche « Tâches quotidiennes » ne fait
   rien.
4. **Supabase en ligne** : SMTP personnalisé (Authentication › Emails ›
   SMTP Settings : `smtp.resend.com`, port 465, utilisateur `resend`, mot de
   passe = une clé Resend, expéditeur `noreply@tremplia.com`, nom
   `Tremplia`), pour les e-mails envoyés depuis le tableau de bord Supabase.
   Leurs modèles (Authentication › Emails › Templates) : recopier
   `supabase/templates/recovery.html` (« Reset password »),
   `magic_link.html` (« Magic link ») et `confirmation.html` (« Confirm
   signup »), avec les sujets de `supabase/config.toml`. Ces fichiers sont
   produits par `templates.ts` ; après une modification :
   `WRITE_SUPABASE_TEMPLATES=1 npx vitest run templates`.

---

## Notifications

Notifications **Web Push** : gratuites, sans application à publier, envoyées
par le service de notification du navigateur (Google pour Chrome et Android,
Apple, Mozilla). Leur contenu est chiffré pour l'appareil : ces services ne
le lisent pas. Code : `src/features/notifications`, affichage par
`public/sw.js`.

| Notification | Qui la reçoit | Déclenchée par |
|---|---|---|
| Message d'un candidat | Le responsable du dossier ; s'il n'y en a pas (ou plus d'actif), les patrons | `sendStudentMessage` |
| Réponse du candidat (validation, demande de modification) | Idem | `submitReview` |
| Tâche confiée | Le membre chargé de la tâche, quand un collègue la lui confie (création, changement de responsable, ou même tâche pour plusieurs dossiers : une seule notification) | `createTask`, `updateTask`, `applyBulkAction` |
| Tâches du jour | Chaque matin vers 8 h, le membre qui l'a demandée, s'il a des tâches du jour ou en retard (campagnes actives) | `/api/cron/task-digest` (`.github/workflows/taches-quotidiennes.yml`) |
| Message de l'agence | Le candidat, sur les appareils activés depuis ses messages, tant que son accès (code) reste le même | `sendAgencyMessage` |

- **Choix** (Réglages › Notifications) : chaque membre pour lui-même, sur
  tous ses appareils. Par défaut tout est coché sauf « Tâches du jour ».
  Un employé désactivé ou qui doit remplacer son mot de passe temporaire ne
  reçoit rien.
- **Appareils** : à activer sur chacun (10 au plus par membre, 5 par
  candidat). Un appareil partagé appartient au dernier qui l'active. Se
  déconnecter met l'appareil en pause : rien n'arrive, et les notifications
  reviennent toutes seules quand **le même compte** se reconnecte ici
  (jamais pour un autre compte) ; « Désactiver » les coupe pour de bon.
  « Déconnecter les autres appareils » (changement de mot de passe) et la
  déconnexion depuis le menu font de même pour les autres appareils ; un mot
  de passe temporaire donné par le patron retire ceux de l'employé.
  Un appareil que le service ne connaît plus (404, 410) est retiré au
  premier envoi.
- **iPhone et iPad** (iOS 16.4 ou plus) : seulement dans l'appli installée
  sur l'écran d'accueil ; Réglages l'explique. Android, ordinateurs : dans
  le navigateur ou l'appli installée.
- Les envois partent après la réponse (`after`) : une notification manquée
  ne fait jamais échouer l'action. Chaque envoi affiche **toujours** une
  notification : Safari (iPhone) retire l'abonnement d'un site qui reçoit des
  envois sans rien afficher.
- **Réparation automatique** (`PushKeeper`, coquille de l'agence et espace
  candidat) : un appareil activé par ce compte est retenu sur l'appareil ; à
  l'ouverture et à chaque retour sur l'appli, il est réenregistré s'il a
  changé ou après une reconnexion (au plus toutes les heures sinon), et son
  abonnement recréé s'il a disparu (quand le navigateur l'accepte sans
  toucher de bouton). Cette réparation ne retire jamais un abonnement.
  « Désactiver » l'oublie.
- **Essai** (Réglages, et cloche de l'espace candidat) : « Envoyer un
  essai », vers cet appareil seulement, ou « Essai dans 15 s » pour fermer
  complètement l'appli et vérifier que la notification arrive quand même.
- **Candidat** : cloche « Notifications » dans l'en-tête de son espace, et
  bouton en haut de ses messages.
- **Refus d'un service** : le code et la raison (Apple : `BadJwtToken`…)
  partent au suivi des erreurs (`[push send]`).

### Mise en place en production (une fois)

1. Créer les clés : `npx web-push generate-vapid-keys`.
2. **Vercel** (Production) : `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`,
   puis redéployer. Garder une copie de la privée hors du dépôt : la
   changer oblige chacun à réactiver ses notifications.
3. La migration `push_notifications` doit être appliquée en ligne avant.

---

## Pages légales

`/mentions-legales`, `/conditions` (conditions générales d'utilisation et de
vente) et `/confidentialite`, ouvertes avec ou sans connexion, liées depuis le
pied de page de l'accueil et des écrans de connexion. Toutes leurs
informations variables (éditeur, statut, NIF, immatriculation, contact,
prestataires, tribunal, date de mise à jour) sont dans `src/config/legal.ts`.
L'inscription demande d'accepter les conditions ; la date de la version
acceptée est gardée dans le journal (`agency.created`, détail `terms`).
Après une modification des conditions, changer `updatedAt`.

---

## Application installable (PWA)

- Manifestes : `src/app/manifest.ts` (agence) et
  `src/app/student/manifest.webmanifest` (candidat).
- Icônes générées : `src/features/pwa/app-icon.tsx`.
- Service worker : `public/sw.js`. Il ne garde aucune donnée, seulement la
  page « Pas de connexion » (`/offline`). Après une modification de cette
  page, changer `VERSION` dans `public/sw.js`. Il affiche aussi les
  [notifications](#notifications).
- Le service worker et l'installation n'existent qu'en production (HTTPS) :
  rien n'apparaît avec `npm run dev`, sauf si l'on active les notifications
  (le service worker est alors enregistré à ce moment-là ; `localhost` compte
  comme sécurisé).

---

## Nom et couleurs

Le nom, la phrase d'accroche et les couleurs de l'application installée sont
dans `src/config/brand.ts` : les changer là suffit (titres des pages, logos,
accueil, manifestes, icônes). Les couleurs de l'interface (thèmes clair et
sombre) sont les variables de `src/app/globals.css`.

Les libellés `tremplia:…` de `src/features/student/server/keys.ts` entrent
dans le calcul des empreintes des codes candidats et des sessions : les
changer oblige à recalculer les empreintes enregistrées (depuis la copie
chiffrée des codes) et déconnecte les candidats.

`project_id` dans `supabase/config.toml` nomme les conteneurs Docker du
Supabase local (`supabase_db_tremplia`, repris par
`.github/workflows/sauvegarde.yml`) : le changer recrée une base locale vide.

---

## Ajouter un modèle de campagne

Créez un fichier dans `src/config/campaign-templates/` (sur le modèle de
`campus-france-2026-2027.ts`), ajoutez-le à `index.ts`, puis lancez
`npm test` : chaque modèle est validé automatiquement par son schéma
(`schema.ts`). Il apparaît ensuite dans la galerie de « Nouvelle campagne ».

---

## Glossaire

| Interface | Code |
|---|---|
| Agence | `agency` |
| Patron / Employé | `owner` / `employee` |
| Campagne | `campaign` |
| Groupe (DAP, Hors-DAP, École…) | `campaign_group` |
| Étape (Constitution du dossier, Entretien…) | `campaign_stage` / `cases.stage_id` |
| Dossier (candidat) | `case` |
| Dossier de documents | `document_folder` |
| Compte externe | `external_account` |
| Modèle de campagne | `campaign_template` (configuration, pas une table) |
| Historique / Journal | `history` / `activity_log` |
| Lettre de motivation | `motivation_letter` |
| Formations | `programs` / `case_program` |
| Paiement / Montant convenu | `case_payment` / `agreed_amount` |
| Avis du candidat | `case_student_review` |
| Message | `case_message` |
| Administrateur de la plateforme | `platform_admin` |

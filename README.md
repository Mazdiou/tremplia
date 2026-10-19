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
14. [Application installable (PWA)](#application-installable-pwa)
15. [Nom et couleurs](#nom-et-couleurs)
16. [Ajouter un modèle de campagne](#ajouter-un-modèle-de-campagne)
17. [Glossaire](#glossaire)

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
| **Tableau de bord** | « À traiter », mes tâches, échéances, réponses des formations, activité récente, par campagne. |
| **Export Excel** | Classeur complet d'une campagne (patron). |
| **Réglages** | Mon compte, mot de passe, apparence (thème clair ou sombre, retenu sur l'appareil ; c'est là qu'il se change sur téléphone) ; pour le patron, l'agence, les valeurs des nouvelles campagnes, le guide de démarrage et l'abonnement. |
| **Guide de démarrage** | Mot de bienvenue à la première connexion de chaque membre, puis, pour le patron d'une nouvelle agence, la liste « Bien démarrer » en haut du tableau de bord : six étapes (campagne, dossier, document, espace candidat, tâche, employé) qui se cochent d'après les vraies données et mènent chacune au bon écran. Masquable (pour toute l'agence), réaffichable dans les réglages. Les agences déjà inscrites ne le voient pas. |
| **Équipe** | Le patron ajoute ses employés (mot de passe temporaire à remplacer à la première connexion), les désactive ou les supprime. |

**Patron / employé.** Les employés travaillent sur les dossiers. Sont réservés
au patron : créer, régler, archiver et exporter une campagne ; gérer l'équipe ;
verrouiller un document ; les actions sensibles vérifiées par les fonctions
SQL.

### Pour le candidat (`/student`)

Connexion avec le code de son dossier, donné par l'agence (sans compte). Le
candidat consulte ses informations, valide ou demande une modification de sa
lettre et de ses formations, et échange avec l'agence par messages.

### Pour l'administrateur de la plateforme (`/admin`)

Liste des agences, enregistrement des paiements d'abonnement et annulation
d'un paiement saisi par erreur.

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
d'une agence et connexion du patron, import du modèle Campus France, création
d'un dossier avec un premier paiement, envoi d'un PDF, ouverture de l'espace
candidat, connexion du candidat et message reçu par l'agence, refus d'un
mauvais code.

En local : Supabase local démarré, `.env.local` pointé dessus, puis
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
  réponse JSON, toute autre exception une 500. Seul le nom de l'erreur est
  écrit dans les logs.
- `dbError(label, error, messages?)` : traduit un code d'erreur PostgreSQL
  (droits, doublon, campagne archivée, document verrouillé, abonnement
  expiré…) en `ApiError`.
- `rateLimited(error, message)` : limite d'essais atteinte → 429.
- Toutes les réponses sont envoyées en `Cache-Control: no-store`.

Côté navigateur, `src/lib/api-client.ts` (`callApi`, `callApiError`) appelle
les routes et renvoie un message prêt à afficher, y compris en cas de coupure
réseau.

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
    login, register, change-password, offline, manifest, icônes…
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
    brand.ts            nom, accroche, couleurs
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
    api-errors, api-client, env, env-server, client-ip, validation,
    dates, money, names, plural, phone, save-file, ui-prefs, xlsx, utils
supabase/
  migrations/           une migration par domaine, dans l'ordre
  tests/                un fichier pgTAP par domaine
  config.toml           configuration du Supabase local
test/                   doublure de "server-only" pour Vitest
e2e/                    tests de bout en bout (Playwright)
scripts/backup/         sauvegarde chiffrée et restauration
```

Domaines de `features/` : `admin`, `agency`, `auth`, `campaigns`, `cases`,
`dashboard`, `documents`, `export`, `history`, `landing`, `messages`,
`motivation-letter`, `notes`, `payments`, `programs`, `pwa`, `settings`,
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
  ajout d'un employé).

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
(« Paiement reçu » : 1, 3 ou 12 mois). Des bandeaux préviennent l'agence
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

---

## Application installable (PWA)

- Manifestes : `src/app/manifest.ts` (agence) et
  `src/app/student/manifest.webmanifest` (candidat).
- Icônes générées : `src/features/pwa/app-icon.tsx`.
- Service worker : `public/sw.js`. Il ne garde aucune donnée, seulement la
  page « Pas de connexion » (`/offline`). Après une modification de cette
  page, changer `VERSION` dans `public/sw.js`.
- Le service worker et l'installation n'existent qu'en production (HTTPS) :
  rien n'apparaît avec `npm run dev`.

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

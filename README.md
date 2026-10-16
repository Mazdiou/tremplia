# StudyFlow

CRM pour les agences de démarches d'études à l'étranger : chaque agence crée
ses campagnes (ou importe un modèle comme Campus France), range ses dossiers
candidats dans des groupes, suit l'étape de chaque dossier (parcours propre à
chaque campagne), et suit documents (téléchargeables en un ZIP), lettre de motivation, formations visées, notes,
comptes sur les plateformes externes et paiements du candidat à l'agence (en dinars).
Le tableau de bord rassemble ce qui attend l'agence (« À traiter »), chaque
campagne s'exporte en Excel (patron), et l'application s'installe sur
téléphone (agence et espace candidat).

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui, zod,
Supabase (PostgreSQL, Auth, Storage, RLS), Vitest, pgTAP.

## Démarrer

```powershell
npm ci
copy .env.example .env.local   # puis remplir les 4 valeurs
npx supabase start             # base locale (Docker requis)
npx supabase db reset          # applique les migrations (efface la base locale)
npm run dev
```

Puis ouvrez http://localhost:3000/register pour créer une agence.

## Vérifications (les mêmes qu'à chaque push, plus la base)

```powershell
npm run typecheck   # génère les types Next puis lance tsc
npx eslint src
npm test            # tests unitaires (Vitest)
npm run build
npx supabase test db  # tests de la base (pgTAP), sur la base locale démarrée
```

## Région de l'hébergement

Les fonctions Vercel tournent dans la région fixée par `vercel.json`
(`arn1`, Stockholm) : la même que la base Supabase (`eu-north-1`,
Stockholm). Chaque page fait plusieurs allers-retours vers la base ; d'un
continent à l'autre, chacun coûte ~100 ms, dans la même région ~2 ms. Si la
base change de région, changer `regions` en conséquence (correspondances :
`eu-central-1` → `fra1`, `eu-west-3` → `cdg1`, `eu-west-2` → `lhr1`,
`us-east-1` → `iad1`).

## Variables d'environnement

Voir `.env.example`. Aucune vraie valeur ne doit être commitée.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (lecture via le RLS) |
| `SUPABASE_SECRET_KEY` | Clé secrète, routes serveur seulement |
| `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY` | Chiffre les mots de passe des comptes externes et les codes candidats, signe les sessions candidat (32 octets, base64) ; à sauvegarder hors du dépôt |
| `SUPPORT_PHONE` | Facultatif. Numéro affiché aux agences pour renouveler leur abonnement (bandeaux, page Équipe) |
| `CLIENT_IP_HEADER` | Facultatif. En-tête qui porte l'adresse IP du visiteur, pour les limites d'essais. Par défaut `x-forwarded-for` (dernière adresse) : correct sur Vercel et derrière nginx ; derrière Cloudflare, `cf-connecting-ip`. À vérifier à chaque changement d'hébergeur |

## Nom et couleurs de l'application

« StudyFlow » est un nom provisoire. Le nom, la phrase d'accroche et les
couleurs de l'application installée sont dans `src/config/brand.ts` : les
changer là suffit (titres des pages, logos, accueil, manifestes, icônes).
Les identifiants techniques `studyflow:…` de
`src/features/student/server/keys.ts` ne doivent pas changer (ils
invalideraient les codes et sessions des candidats).

## Application installable (PWA)

Manifestes `src/app/manifest.ts` (agence) et
`src/app/student/manifest.webmanifest` (candidat), icônes générées
(`src/features/pwa/app-icon.tsx`), service worker `public/sw.js`. Le service
worker ne garde aucune donnée : seulement la page « Pas de connexion »
(`/offline`). Après une modification de cette page, changer `VERSION` dans
`public/sw.js`. Le service worker et l'installation n'existent qu'en
production (HTTPS) : rien n'apparaît avec `npm run dev`.

## Abonnements et administration

Chaque agence a 7 jours d'essai, puis un abonnement payé (espèces, CCP ou
BaridiMob) que l'administrateur de la plateforme enregistre dans `/admin`
(« Paiement reçu » : 1, 3 ou 12 mois). Après la date de fin, l'agence est en
lecture seule : la base refuse toute écriture sur ses données.

L'administrateur se désigne à la main, une seule fois, dans l'éditeur SQL de
Supabase. Son compte doit aussi être celui d'une agence (la sienne) :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'votre-email@exemple.com';
```

Pour retirer ce droit : `delete from public.platform_admins where user_id = '…';`.

## Règles du projet

- **Isolation stricte entre agences**, garantie par la base (RLS et clés
  composites agence + campagne), pas seulement par les routes.
- **Le navigateur lit via le RLS ; il n'écrit jamais.** Les écritures passent
  par les routes serveur. Seule exception : l'envoi d'un PDF va directement au
  stockage, avec une URL signée préparée par le serveur (limite de taille de
  Vercel).
- **Le serveur n'a que les droits nécessaires**, table par table. Dès qu'une
  règle dépend de l'acteur ou de son rôle (patron / employé), l'écriture passe
  par une fonction SQL qui le vérifie. Un test pgTAP fige la liste exacte des
  droits (`supabase/tests/core_test.sql`).
- **Rien n'est supprimé de ce qui fait l'historique** : un dossier jamais, un
  employé qui a créé quelque chose est désactivé, pas supprimé.
- **Aucune donnée personnelle** dans une URL, un journal technique
  (`console.*`), un message d'erreur ou le journal d'activité. Les recherches
  par identité passent en POST.
- **Mots de passe des comptes externes** chiffrés par le serveur, illisibles
  côté client ; chaque affichage est inscrit au journal avant d'être renvoyé.
- **Espace candidat** (`/student`) : le candidat se connecte avec le code de
  son dossier, sans compte Supabase. Session dans un cookie signé, revérifiée
  à chaque affichage ; lecture seule (informations, lettre, formations) par
  le serveur, filtrée sur le dossier de la session. La base ne garde que
  l'empreinte du code et une copie chiffrée ; 10 essais ratés par adresse
  sur 15 minutes. Le candidat valide ou demande une modification ; toute
  modification de la lettre ou des formations par l'agence redemande son avis.
  Une conversation par dossier (onglet Messages des deux côtés) ; pastilles
  de non-lus dans le dossier, l'arbre et le tableau de bord.
- **Code en anglais, interface en français.** Une seule source de vérité par
  liste métier (`features/*/labels.ts`).

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

## Structure du dépôt

```
src/
  app/                  pages, layouts et routes API (minces)
  components/           partagés : ui/ (shadcn), shell/, auth/, page-ui, form-fields
  hooks/                hooks React partagés (menus, fenêtres, valeurs du navigateur)
  config/
    campaign-templates/ modèles de campagne (un fichier par modèle)
  features/
    admin/ agency/ auth/ campaigns/ cases/ dashboard/ documents/ export/ history/
    landing/ messages/ motivation-letter/ notes/ payments/ programs/ pwa/ stages/
    student/ subscription/ team/ whatsapp/
      components/       composants React de la fonctionnalité
      server/           lectures et écritures serveur (« server-only »)
      schemas.ts        schémas zod partagés formulaires / routes
      labels.ts         listes métier et libellés français
  lib/                  transverse : supabase/ (clients, lecture par pages), auth/,
                        crypto/, audit/, api-errors, api-client (appels depuis le
                        navigateur), dates, money, names, plural, phone,
                        validation, xlsx (classeurs Excel)…
supabase/
  migrations/           une migration par domaine
  tests/                un fichier pgTAP par domaine
```

## Ajouter un modèle de campagne

Créez un fichier dans `src/config/campaign-templates/` (sur le modèle de
`campus-france-2026-2027.ts`), ajoutez-le à `index.ts`, puis lancez
`npm test` : chaque modèle est validé automatiquement.

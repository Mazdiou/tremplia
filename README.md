# StudyFlow

CRM pour les agences de démarches d'études à l'étranger : campagnes,
dossiers d'étudiants, documents PDF et comptes sur les plateformes externes.

Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, Supabase.

## Démarrer

```powershell
npm ci
copy .env.example .env.local   # puis remplir les 4 valeurs
npx supabase start             # base locale (Docker requis)
npx supabase db reset          # applique les migrations
npm run dev
```

## Vérifications (les mêmes qu'à chaque push)

```powershell
npm run typecheck   # génère les types Next puis lance tsc
npx eslint src
npm test            # tests unitaires (Vitest)
npm run build
npx supabase test db  # tests de la base (pgTAP)
```

## Variables d'environnement

Voir `.env.example`. Aucune variable ne doit jamais être commitée.
Sans `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`, les mots de passe des comptes externes
ne peuvent ni être enregistrés ni affichés ; sauvegardez cette clé hors du dépôt.

## Règles du projet

- Isolation stricte entre agences ; rôles patron et employé respectés côté base.
- Le navigateur lit via le RLS ; les écritures passent par les routes serveur.
- Aucune donnée personnelle dans une URL, un journal technique ou un message d'erreur.

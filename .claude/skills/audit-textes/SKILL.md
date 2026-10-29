---
name: audit-textes
description: Audit des textes visibles de Tremplia (interface, espace candidat, accueil, e-mails, notifications, exports) pour un ton de SaaS moderne, court et épuré. À utiliser quand l'utilisateur demande de relire, raccourcir ou harmoniser les textes, ou après une nouvelle fonctionnalité. Argument facultatif : un dossier ou un écran (ex. src/app/(app)/settings).
---

# Audit des textes

Objectif : des textes courts, humains et cohérents, comme dans les SaaS modernes
(Linear, Notion, Stripe). On relit, on propose, l'utilisateur valide, puis on
applique. **Ne rien modifier avant la validation.**

## 1. Relever les textes

```
node .claude/skills/audit-textes/extract.mjs [dossier] --flagged
```

Sans `--flagged`, le script liste tous les textes (2 600 environ). Ses
alertes (long, plusieurs phrases, guillemets droits, espace manquante avant
« : », anglicisme, tutoiement, « ! ») sont des pistes, pas un verdict :
il y a du bruit (XML de l'export Excel, requêtes CSS). Le script ne voit pas
les textes construits ailleurs : lire aussi les écrans eux-mêmes.

Relire écran par écran, dans cet ordre :
accueil et pages de connexion, tableau de bord, liste et fiche d'un dossier
(chaque onglet), campagnes, tâches, paiements, équipe, réglages,
administration, espace candidat, e-mails (`src/lib/email`, `src/features/*/emails*`),
notifications (`src/features/notifications/texts.ts`), export Excel,
messages d'erreur des API (`MESSAGES`, `dbError`).

## 2. Les règles

**D'abord se demander si le texte peut disparaître**
- Un titre et un bouton clairs se passent souvent de description
  (« Déconnexion » + « Se déconnecter » : rien à ajouter). On ne reformule
  que ce qui doit rester.
- Un sous-titre qui répète ce que l'écran montre, ou qui s'adresse à
  quelqu'un d'autre que le lecteur (« Seul le patron gère l'équipe » sur
  une page que seul le patron voit), disparaît.

**Une vraie phrase, jamais du télégraphique**
- Court ne veut pas dire haché : « Totaux et export : tous les paiements. »
  se lit comme une note. Écrire « Les totaux et l'export comptent tous les
  paiements. »
- Être précis plutôt que vague : « Nouveaux messages, pièces reçues et
  tâches du jour » plutôt que « les alertes importantes ».

**Écran vide = titre court + bénéfice + bouton**
- Pas de mode d'emploi (« Ajoutez-la depuis l'onglet Tâches du dossier,
  ou… »). Un titre (« Aucune tâche »), une phrase sur ce que ça apporte
  (« Notez ce qu'il reste à faire, Tremplia vous le rappelle. ») et, si
  possible, un bouton vers l'action.

**Concision**
- Description sous un titre de section : une phrase, 90 caractères au plus.
  Elle dit à quoi sert la section, pas comment elle marche.
- Les détails (où c'est rangé, qui voit quoi, ce qui se passe ensuite) vont
  à côté de l'action concernée, dans un texte d'aide sous le champ ou le
  bouton, ou disparaissent s'ils n'aident pas à agir.
- Pas de parenthèses explicatives dans une description
  (« rangés comme dans Tremplia (campagne, groupe, candidat) »).
- Libellé de champ : 1 à 4 mots. Bouton : un verbe à l'infinitif
  (« Enregistrer », « Demander une pièce »), 3 mots au plus si possible.
- Infobulle (`title`) : 6 mots au plus ; si l'icône a besoin d'une phrase,
  le bouton a besoin d'un texte.
- Message de succès : le fait, sans point (« Note ajoutée »).
- Message d'erreur : ce qui s'est passé + ce qu'il faut faire, sans jargon
  (« Le fichier dépasse 10 Mo. Choisissez un PDF plus léger. »).

Exemple :
> Avant : « Les documents des dossiers en cours, rangés comme dans Tremplia
> (campagne, groupe, candidat), pour les déposer facilement sur les
> plateformes. Propre à cet ordinateur et à votre compte. »
> Après : « Une copie des documents sur cet ordinateur, prête à déposer sur
> les plateformes. »

**Ton**
- Vouvoiement partout (agence et candidat). Phrases simples, actives.
- Pas de « ! », sauf un seul message de bienvenue ou de réussite finale.
- Pas de jargon technique (« session », « token », « synchronisation »,
  « RLS ») : dire ce que la personne voit.
- Une majuscule seulement au début (« Pièces demandées », pas « Pièces
  Demandées »).

**Ponctuation française**
- Espace avant « : » (et « ; ! ? »), guillemets « … » avec espaces, points
  de suspension « … » (un seul caractère).
- Jamais de « · » dans un texte visible (préférence forte de l'utilisateur).
  À la place : `MetaList` (informations à la suite), `CountBadge`
  (compteurs), sinon une phrase avec virgules, deux-points ou parenthèses.
- Titres de page : « Page – Tremplia » (tiret demi-cadratin).
- Pas de point final dans un titre, un bouton, un libellé, une pastille,
  un message de succès d'une ligne. Point final dans une phrase d'aide.
- Nombres : `plural()` de `src/lib/plural.ts` (« 1 dossier », « 2 dossiers »).

**Vocabulaire imposé** (toujours le même mot pour la même chose)
- agence, patron (pas « propriétaire », « admin »), employé, membre
- dossier (pas « fiche », « candidature » pour l'objet), candidat
- campagne, groupe, étape
- document (fichier rangé), pièce (document demandé au candidat)
- formation (pas « programme », « vœu »), lettre de motivation
- tâche, note, message, paiement, montant convenu, reste à payer
- espace candidat, code d'accès
- e-mail (pas « mail », « courriel », « email »)
- abonnement, essai gratuit

**Cohérence**
- La même action porte le même verbe partout : repérer « Supprimer » /
  « Retirer » / « Effacer », « Ajouter » / « Créer » / « Nouveau » pour une
  même chose, et choisir.
- Un texte répété à plusieurs endroits (même message d'erreur) vient d'une
  seule constante.

## 3. Le rapport

Écrire le rapport dans le dossier scratchpad (`audit-textes.md`), regroupé
par écran, puis le résumer à l'utilisateur. Pour chaque texte :

| Fichier:ligne | Avant | Après | Pourquoi |

Classer en trois niveaux : à corriger (faute, incohérence, texte trop
long sur un écran fréquent), à améliorer, et détails. Indiquer le nombre
total de textes revus. Attendre la validation (tout, ou une liste).

## 4. Appliquer

- Modifier avec l'outil Edit (copie de travail en CRLF : pas de sed
  multi-lignes).
- Chercher chaque ancien texte dans `e2e/`, les `*.test.ts` et les scripts
  du scratchpad (`git grep -n "ancien texte"`) et les mettre à jour.
- Un texte d'e-mail modifié : régénérer `supabase/templates/*.html`
  (`WRITE_SUPABASE_TEMPLATES=1 npx vitest run templates`) et rappeler à
  l'utilisateur de les recopier dans Supabase.
- Vérifier : `npm run typecheck`, `npm run lint`, `npx vitest run`,
  `npm run build`, `npx playwright test`, puis captures des écrans touchés
  sur ordinateur, téléphone (360 px) et en mode sombre : pas de texte coupé,
  pas de défilement horizontal.
- Relancer `extract.mjs --flagged` : le nombre de textes signalés doit
  baisser.
- Demander avant de fusionner ou de pousser.

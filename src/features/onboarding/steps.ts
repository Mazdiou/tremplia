// Guide « Bien démarrer » : les six étapes d'une nouvelle agence. Chacune se
// coche d'après les vraies données (onboarding_progress, migration onboarding).

export type OnboardingProgress = {
  hasCampaign: boolean;
  hasCase: boolean;
  hasDocument: boolean;
  hasStudentAccess: boolean;
  hasTask: boolean;
  hasEmployee: boolean;
  // Dernier dossier créé : là où mènent les étapes qui en demandent un
  latestCaseId: string | null;
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  // Bouton de l'étape ; null tant qu'un dossier manque
  action: { label: string; href: string } | null;
  // Lien secondaire, sous le bouton
  secondary?: { label: string; href: string };
};

export function buildSteps(p: OnboardingProgress): OnboardingStep[] {
  const caseHref = (path: string) => (p.latestCaseId ? `/cases/${p.latestCaseId}${path}` : null);
  const onCase = (label: string, path: string) => {
    const href = caseHref(path);
    return href ? { label, href } : null;
  };
  return [
    {
      id: "campagne",
      title: "Créer une campagne",
      description:
        "Une campagne regroupe les dossiers d'une même année, avec ses dates et ses étapes.",
      done: p.hasCampaign,
      action: { label: "Créer une campagne", href: "/campaigns/new" },
      secondary: { label: "Partir d'un modèle", href: "/campaigns#modeles" },
    },
    {
      id: "dossier",
      title: "Ajouter un premier dossier",
      description: "Un dossier par candidat : identité, parcours et montant convenu.",
      done: p.hasCase,
      action: p.hasCampaign ? { label: "Nouveau dossier", href: "/cases/new" } : null,
    },
    {
      id: "document",
      title: "Déposer un document",
      description: "Passeport, relevés de notes, diplômes : rangés dans le dossier du candidat.",
      done: p.hasDocument,
      action: onCase("Ouvrir les documents", "/documents"),
      secondary: { label: "Les retrouver aussi sur cet ordinateur", href: "/settings#ordinateur" },
    },
    {
      id: "espace-candidat",
      title: "Ouvrir l'espace candidat",
      description: "Avec son code, le candidat suit son dossier, valide sa lettre et vous écrit.",
      done: p.hasStudentAccess,
      action: onCase("Ouvrir l'accès", "?ouvrir=espace-candidat"),
    },
    {
      id: "tache",
      title: "Créer une tâche de relance",
      description: "Notez ce qu'il reste à faire et pour quand : Tremplia vous le rappelle.",
      done: p.hasTask,
      action: onCase("Ajouter une tâche", "/tasks"),
    },
    {
      id: "equipe",
      title: "Ajouter un employé",
      description: "Vos employés travaillent sur les mêmes dossiers, chacun avec son compte.",
      done: p.hasEmployee,
      action: { label: "Ajouter un employé", href: "/team" },
    },
  ];
}

// Étape ouverte au départ : la première qui reste à faire
export function firstOpenStep(steps: OnboardingStep[]): string | null {
  return steps.find((s) => !s.done)?.id ?? null;
}

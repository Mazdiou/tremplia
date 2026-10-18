// Types partagés entre les pages (serveur) et les composants des tâches

export type TaskMember = { id: string; name: string; isActive: boolean };

export type TaskItem = {
  id: string;
  title: string;
  details: string | null;
  dueDate: string | null;
  assignedTo: string;
  assigneeName: string;
  // Affiché seulement si l'auteur n'est pas le responsable
  creatorName: string | null;
  createdAt: string;
  // Tâche faite : « Faite par Sara, le 21/10/2026 »
  doneLabel: string | null;
  // Affichage seulement : la vraie règle est appliquée par la base
  canEdit: boolean;
  canDelete: boolean;
};

// Contexte commun au formulaire (onglet et raccourci de l'en-tête)
export type TaskFormContext = {
  caseId: string;
  members: TaskMember[];
  currentUserId: string;
  // Jour de l'application (AAAA-MM-JJ), calculé par le serveur
  today: string;
};

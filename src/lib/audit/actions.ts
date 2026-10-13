// Seule liste des actions du journal d'activité : le serveur n'écrit que
// celles-ci, et l'historique a un libellé pour chacune.
export const ACTIVITY_ACTIONS = [
  "agency.created",
  "employee.created",
  "employee.deactivated",
  "employee.reactivated",
  "employee.deleted",
  "case.created",
  "case.updated",
  "case.assigned",
  "case.closed",
  "case.abandoned",
  "case.reopened",
  "pastel.credentials_updated",
  "pastel.password_viewed",
  "document.added",
  "document.renamed",
  "document.deleted",
  "document.locked",
  "document.unlocked",
  "document.moved",
  "folder.created",
  "folder.renamed",
  "folder.deleted",
  "note.created",
  "note.updated",
  "note.deleted",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

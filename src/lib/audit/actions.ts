// Seule liste des actions du journal d'activité : le serveur n'écrit que
// celles-ci, et l'historique a un libellé pour chacune.
export const ACTIVITY_ACTIONS = [
  "agency.created",
  "employee.created",
  "employee.deactivated",
  "employee.reactivated",
  "employee.deleted",
  "campaign.created",
  "campaign.imported",
  "campaign.updated",
  "campaign.archived",
  "campaign.unarchived",
  "campaign.deleted",
  "group.created",
  "group.renamed",
  "group.deleted",
  "case.created",
  "case.updated",
  "case.assigned",
  "case.status_changed",
  "case.groups_updated",
  "external_account.saved",
  "external_account.password_viewed",
  "document.added",
  "document.renamed",
  "document.deleted",
  "document.locked",
  "document.unlocked",
  "document.moved",
  "document_folder.created",
  "document_folder.renamed",
  "document_folder.deleted",
  "note.created",
  "note.updated",
  "note.deleted",
  "motivation_letter.saved",
  "program.created",
  "program.updated",
  "program.deleted",
  "program.moved",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityTarget =
  | "agency"
  | "profile"
  | "campaign"
  | "campaign_group"
  | "case"
  | "external_account"
  | "document"
  | "document_folder"
  | "case_note"
  | "motivation_letter"
  | "case_program";

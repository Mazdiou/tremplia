// Seule liste des actions du journal d'activité : le serveur n'écrit que
// celles-ci, et l'historique a un libellé pour chacune.
export const ACTIVITY_ACTIONS = [
  "agency.created",
  "agency.updated",
  "agency.defaults_updated",
  "account.password_changed",
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
  "campaign.exported",
  "campaign.stages_updated",
  "group.created",
  "group.renamed",
  "group.deleted",
  "case.created",
  "case.updated",
  "case.assigned",
  "case.status_changed",
  "case.groups_updated",
  "case.stage_changed",
  "external_account.saved",
  "external_account.password_viewed",
  "document.added",
  "document.renamed",
  "document.deleted",
  "document.locked",
  "document.unlocked",
  "document.moved",
  "document.archive_downloaded",
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
  "program.result_set",
  "student_access.enabled",
  "student_access.disabled",
  "student_access.regenerated",
  "message.sent",
  "payment.agreed_amount_set",
  "payment.recorded",
  "payment.cancelled",
  "task.created",
  "task.updated",
  "task.assigned",
  "task.completed",
  "task.reopened",
  "task.deleted",
  "task.all_completed",
  // Actions du candidat lui-même (actor_id vide)
  "student.logged_in",
  "student.approved",
  "student.changes_requested",
  "student.message_sent",
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
  | "case_program"
  | "case_message"
  | "case_payment"
  | "case_task";

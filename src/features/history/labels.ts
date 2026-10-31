import { ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/audit/actions";

// Deux tournures : dans la fiche d'un dossier (« a créé le dossier ») et dans
// l'activité de toute l'agence (« a créé un dossier »). Le type impose un
// libellé pour chaque action.

const AGENCY_LABELS: Record<ActivityAction, string> = {
  "agency.created": "a créé l'agence",
  "agency.updated": "a modifié le profil de l'agence",
  "agency.defaults_updated": "a modifié les valeurs par défaut des campagnes",
  "account.password_changed": "a changé son mot de passe",
  "employee.created": "a ajouté un employé",
  "employee.deactivated": "a désactivé un employé",
  "employee.reactivated": "a réactivé un employé",
  "employee.permissions_changed": "a changé les permissions d'un employé",
  "employee.password_reset": "a donné un nouveau mot de passe temporaire à un employé",
  "employee.deleted": "a supprimé un employé",
  "campaign.created": "a créé une campagne",
  "campaign.imported": "a importé un modèle de campagne",
  "campaign.updated": "a modifié une campagne",
  "campaign.archived": "a archivé une campagne",
  "campaign.unarchived": "a réactivé une campagne",
  "campaign.deleted": "a supprimé une campagne",
  "campaign.exported": "a exporté une campagne en Excel",
  "campaign.stages_updated": "a modifié les étapes d'une campagne",
  "group.created": "a créé un groupe",
  "group.renamed": "a renommé un groupe",
  "group.deleted": "a supprimé un groupe",
  "case.created": "a créé un dossier",
  "case.updated": "a modifié un dossier",
  "case.assigned": "a changé le responsable d'un dossier",
  "case.status_changed": "a changé le statut d'un dossier",
  "case.groups_updated": "a changé le classement d'un dossier",
  "case.stage_changed": "a changé l'étape d'un dossier",
  "external_account.saved": "a enregistré un compte externe",
  "external_account.password_viewed": "a affiché le mot de passe d'un compte externe",
  "external_account.handed_over": "a affiché les comptes à remettre à un candidat",
  "document.added": "a ajouté un document",
  "document.renamed": "a renommé un document",
  "document.deleted": "a supprimé un document",
  "document.locked": "a verrouillé un document",
  "document.unlocked": "a déverrouillé un document",
  "document.moved": "a déplacé un document",
  "document.archive_downloaded": "a téléchargé les documents d'un dossier (ZIP)",
  "document.copied_locally": "a copié des documents sur son ordinateur",
  "document_folder.created": "a créé une catégorie de documents",
  "document_folder.renamed": "a renommé une catégorie de documents",
  "document_folder.deleted": "a supprimé une catégorie de documents",
  "document_request.created": "a demandé une pièce à un candidat",
  "document_request.updated": "a modifié une pièce demandée",
  "document_request.deleted": "a retiré une pièce demandée",
  "document_request.accepted": "a accepté une pièce envoyée par un candidat",
  "document_request.unaccepted": "a annulé l'acceptation d'une pièce",
  "note.created": "a ajouté une note",
  "note.updated": "a modifié une note",
  "note.deleted": "a supprimé une note",
  "motivation_letter.saved": "a modifié une lettre de motivation",
  "program.created": "a ajouté une formation",
  "program.updated": "a modifié une formation",
  "program.deleted": "a supprimé une formation",
  "program.moved": "a changé l'ordre des formations",
  "program.result_set": "a noté la réponse d'un établissement",
  "student_access.enabled": "a ouvert l'accès d'un candidat",
  "student_access.disabled": "a fermé l'accès d'un candidat",
  "student_access.regenerated": "a créé un nouveau code candidat",
  "message.sent": "a écrit à un candidat",
  "payment.agreed_amount_set": "a fixé le montant convenu d'un dossier",
  "payment.recorded": "a enregistré un paiement",
  "payment.cancelled": "a annulé un paiement",
  "payment.exported": "a exporté les paiements en Excel",
  "task.created": "a ajouté une tâche",
  "task.updated": "a modifié une tâche",
  "task.assigned": "a confié une tâche à un autre membre",
  "task.completed": "a terminé une tâche",
  "task.reopened": "a rouvert une tâche",
  "task.deleted": "a supprimé une tâche",
  "task.all_completed": "a marqué faites les tâches d'un dossier",
  "student.logged_in": "s'est connecté à son espace",
  "student.approved": "a validé sa lettre et ses formations",
  "student.changes_requested": "a demandé une modification",
  "student.message_sent": "a envoyé un message",
  "student.document_sent": "a envoyé une pièce demandée",
  "student.document_replaced": "a remplacé une pièce envoyée",
  "student.document_removed": "a retiré une pièce envoyée",
};

const CASE_LABELS: Record<ActivityAction, string> = {
  ...AGENCY_LABELS,
  "case.created": "a créé le dossier",
  "case.updated": "a modifié le dossier",
  "case.assigned": "a changé le responsable",
  "case.status_changed": "a changé le statut du dossier",
  "case.groups_updated": "a changé le classement du dossier",
  "case.stage_changed": "a changé l'étape du dossier",
  "motivation_letter.saved": "a modifié la lettre de motivation",
  "external_account.handed_over": "a affiché les comptes à remettre au candidat",
  "student_access.enabled": "a ouvert l'accès du candidat",
  "student_access.disabled": "a fermé l'accès du candidat",
  "student_access.regenerated": "a créé un nouveau code candidat",
  "message.sent": "a écrit au candidat",
  "document_request.created": "a demandé une pièce au candidat",
  "document_request.accepted": "a accepté une pièce du candidat",
  "payment.agreed_amount_set": "a fixé le montant convenu",
  "document.archive_downloaded": "a téléchargé tous les documents (ZIP)",
  "document.copied_locally": "a copié les documents sur son ordinateur",
  "task.all_completed": "a marqué faites les tâches du dossier",
};

const UNKNOWN = "a effectué une action";

function isKnown(action: string): action is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(action);
}

// Une action inconnue (ancienne ou future) ne fait jamais planter la page.
export function activityLabel(action: string, scope: "case" | "agency") {
  if (!isKnown(action)) return UNKNOWN;
  return (scope === "case" ? CASE_LABELS : AGENCY_LABELS)[action];
}

// Auteur affiché : le candidat pour ses propres actions, sinon le membre
// (ou « Un ancien membre » s'il a été supprimé)
export function activityActor(
  action: string,
  memberName: string | null | undefined,
  scope: "case" | "agency",
) {
  if (action.startsWith("student.")) return scope === "case" ? "Le candidat" : "Un candidat";
  // Majuscule en tête de ligne (« un membre » quand le nom est illisible)
  const name = memberName || "Un ancien membre";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

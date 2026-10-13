import { ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/audit/actions";

// Deux tournures : dans la fiche d'un dossier (« a créé le dossier ») et dans
// l'activité de toute l'agence (« a créé un dossier »). Le type impose un
// libellé pour chaque action.

const CASE_LABELS: Record<ActivityAction, string> = {
  "agency.created": "a créé l'agence",
  "employee.created": "a ajouté un employé",
  "employee.deactivated": "a désactivé un employé",
  "employee.reactivated": "a réactivé un employé",
  "employee.deleted": "a supprimé un employé",
  "case.created": "a créé le dossier",
  "case.updated": "a modifié le dossier",
  "case.assigned": "a changé le responsable",
  "case.closed": "a clos le dossier",
  "case.abandoned": "a marqué le dossier comme abandonné",
  "case.reopened": "a rouvert le dossier",
  "pastel.credentials_updated": "a modifié le compte Pastel",
  "pastel.password_viewed": "a affiché le mot de passe Pastel",
  "document.added": "a ajouté un document",
  "document.renamed": "a renommé un document",
  "document.deleted": "a supprimé un document",
  "document.locked": "a verrouillé un document",
  "document.unlocked": "a déverrouillé un document",
  "document.moved": "a déplacé un document",
  "folder.created": "a créé un dossier de documents",
  "folder.renamed": "a renommé un dossier de documents",
  "folder.deleted": "a supprimé un dossier de documents",
  "note.created": "a ajouté une note",
  "note.updated": "a modifié une note",
  "note.deleted": "a supprimé une note",
};

const AGENCY_LABELS: Record<ActivityAction, string> = {
  ...CASE_LABELS,
  "agency.created": "a créé une agence",
  "case.created": "a créé un dossier",
  "case.updated": "a modifié un dossier",
  "case.assigned": "a changé le responsable d'un dossier",
  "case.closed": "a clos un dossier",
  "case.abandoned": "a marqué un dossier comme abandonné",
  "case.reopened": "a rouvert un dossier",
  "pastel.credentials_updated": "a modifié les accès Pastel",
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

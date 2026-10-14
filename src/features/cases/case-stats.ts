// Compteurs de dossiers calculés à partir de la vue case_stats (une ligne
// par campagne, statut, niveau et responsable) : une seule requête par page
// au lieu d'une par compteur.

export type CaseStatRow = {
  campaign_id: string;
  status: string;
  education_level: string;
  assigned_to: string | null;
  cases: number;
  created_last_week: number;
  // Reste à encaisser (dossiers non abandonnés), en dinars
  remaining: number;
  // Dossiers non abandonnés qui doivent encore de l'argent
  owing: number;
  // Dossiers actifs sans montant convenu
  fee_unset: number;
};

type Filter = Partial<{
  campaignId: string;
  status: string | readonly string[];
  educationLevel: string;
  assignedTo: string;
}>;

function matches(r: CaseStatRow, f: Filter) {
  if (f.campaignId !== undefined && r.campaign_id !== f.campaignId) return false;
  if (f.status !== undefined) {
    const wanted = typeof f.status === "string" ? [f.status] : f.status;
    if (!wanted.includes(r.status)) return false;
  }
  if (f.educationLevel !== undefined && r.education_level !== f.educationLevel) return false;
  if (f.assignedTo !== undefined && r.assigned_to !== f.assignedTo) return false;
  return true;
}

// Nombre de dossiers correspondant au filtre (tous les dossiers sans filtre)
export function countCases(rows: CaseStatRow[], filter: Filter = {}) {
  return rows.reduce((n, r) => (matches(r, filter) ? n + r.cases : n), 0);
}

// Dossiers créés ces 7 derniers jours, tous statuts confondus
export function countCreatedLastWeek(rows: CaseStatRow[], filter: Filter = {}) {
  return rows.reduce((n, r) => (matches(r, filter) ? n + r.created_last_week : n), 0);
}

// Somme d'une colonne de paiement sur les lignes correspondant au filtre
export function sumStat(
  rows: CaseStatRow[],
  column: "remaining" | "owing" | "fee_unset",
  filter: Filter = {},
) {
  return rows.reduce((n, r) => (matches(r, filter) ? n + Number(r[column]) : n), 0);
}

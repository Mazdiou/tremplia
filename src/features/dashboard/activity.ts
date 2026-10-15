// Activité récente du tableau de bord : les lignes identiques qui se suivent
// (même auteur, même action, même objet) sont regroupées en une seule,
// « a exporté une campagne en Excel · 6 fois », au lieu de remplir la liste.

export type ActivityRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  case_id: string | null;
  created_at: string;
};

export type ActivityGroup = ActivityRow & { count: number };

const sameEntry = (a: ActivityRow, b: ActivityRow) =>
  a.actor_id === b.actor_id &&
  a.action === b.action &&
  a.target_id === b.target_id &&
  a.case_id === b.case_id;

// Lignes de la plus récente à la plus ancienne ; chaque groupe garde la date
// de sa ligne la plus récente
export function groupActivity(rows: ActivityRow[], max: number): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && sameEntry(last, row)) last.count++;
    else if (groups.length < max) groups.push({ ...row, count: 1 });
    else break;
  }
  return groups;
}

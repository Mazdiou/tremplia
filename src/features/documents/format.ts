// Chemin construit par le serveur seulement, jamais à partir d'un nom saisi.
export function documentPath(agencyId: string, caseId: string, docId: string) {
  return `${agencyId}/${caseId}/${docId}.pdf`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

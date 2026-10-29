import { callApi } from "@/lib/api-client";

// Ouvre dans un nouvel onglet le lien signé (une minute) que renvoie la
// route `endpoint`. La fenêtre est ouverte tout de suite (dans le clic de
// l'utilisateur) pour éviter le blocage des fenêtres, puis dirigée vers le
// lien. Renvoie l'erreur à afficher, sinon null.
export async function openSignedLink(endpoint: string): Promise<string | null> {
  const win = window.open("about:blank", "_blank");
  const res = await callApi<{ url?: unknown }>(endpoint);
  if (!res.ok || typeof res.data.url !== "string") {
    win?.close();
    return res.ok ? "Impossible d'ouvrir le document" : res.error;
  }
  if (!win) return "Le navigateur a bloqué l'ouverture. Autorisez les fenêtres pour ce site.";
  win.opener = null;
  win.location.href = res.data.url;
  return null;
}

// Document d'un dossier, côté agence
export function openDocument(caseId: string, docId: string) {
  return openSignedLink(`/api/cases/${caseId}/documents/${docId}/open`);
}

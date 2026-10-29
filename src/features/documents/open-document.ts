import { callApi } from "@/lib/api-client";

// Ouvre un document dans un nouvel onglet. La fenêtre est ouverte tout de
// suite (dans le clic de l'utilisateur) pour éviter le blocage des fenêtres,
// puis dirigée vers le lien signé d'une minute. Renvoie l'erreur à
// afficher, sinon null.
export async function openDocument(caseId: string, docId: string): Promise<string | null> {
  const win = window.open("about:blank", "_blank");
  const res = await callApi<{ url?: unknown }>(`/api/cases/${caseId}/documents/${docId}/open`);
  if (!res.ok || typeof res.data.url !== "string") {
    win?.close();
    return res.ok ? "Impossible d'ouvrir le document" : res.error;
  }
  if (!win) return "Le navigateur a bloqué l'ouverture. Autorisez les fenêtres pour ce site.";
  win.opener = null;
  win.location.href = res.data.url;
  return null;
}

// Marque des boutons « Nouveau dossier » que reprend le raccourci Shift+N
// (NewCaseShortcut) : leur lien porte déjà la campagne en cours. Hors du
// composant client pour rester utilisable par les composants serveur.
export const NEW_CASE_LINK_PROPS = { "data-new-case": "" } as const;
export const NEW_CASE_LINK_SELECTOR = "a[data-new-case]";
export const NEW_CASE_TITLE = "Nouveau dossier (Shift+N)";

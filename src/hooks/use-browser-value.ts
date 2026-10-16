import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// Valeur connue seulement dans le navigateur (adresse de la page…) : null au
// rendu serveur et à l'hydratation, puis la vraie valeur juste après, sans
// erreur d'hydratation. `get` doit renvoyer une valeur stable (texte, nombre).
export function useBrowserValue<T>(get: () => T): T | null {
  return useSyncExternalStore(noSubscribe, get, () => null);
}

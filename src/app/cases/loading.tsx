import { LoadingPlaceholder } from "@/components/loading-placeholder";

// Ouverture d'un dossier : l'arbre reste affiché pendant le chargement
export default function Loading() {
  return <LoadingPlaceholder withHeader />;
}

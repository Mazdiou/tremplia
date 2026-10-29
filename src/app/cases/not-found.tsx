import Link from "next/link";
import { FolderSearch } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";

// Dossier inexistant, ou d'une autre agence (on ne dit pas lequel des deux) :
// l'arbre des dossiers reste affiché à côté
export default function CaseNotFound() {
  return (
    <PageContainer width="narrow">
      <EmptyState
        icon={FolderSearch}
        title="Dossier introuvable"
        description="Il a peut-être été supprimé, ou le lien est incorrect."
        action={
          <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
            Retour aux dossiers
          </Link>
        }
      />
    </PageContainer>
  );
}

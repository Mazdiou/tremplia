import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";

// À la place d'un formulaire de création ou de modification quand
// l'abonnement de l'agence est expiré
export function ReadOnlyNotice({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <PageContainer width="narrow">
      <EmptyState
        icon={Lock}
        title="Agence en lecture seule"
        description="L'abonnement est expiré : vos données restent consultables, mais plus rien ne peut être ajouté ni modifié tant qu'il n'est pas renouvelé."
        action={
          <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
            {backLabel}
          </Link>
        }
      />
    </PageContainer>
  );
}

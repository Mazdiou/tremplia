import Link from "next/link";
import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";

// Campagne inexistante, supprimée ou d'une autre agence
export default function CampaignNotFound() {
  return (
    <PageContainer width="narrow">
      <EmptyState
        icon={CalendarX}
        title="Campagne introuvable"
        description="Cette campagne n'existe pas, a été supprimée ou n'appartient pas à votre agence."
        action={
          <Link href="/campaigns" className={buttonVariants({ variant: "outline" })}>
            Retour aux campagnes
          </Link>
        }
      />
    </PageContainer>
  );
}

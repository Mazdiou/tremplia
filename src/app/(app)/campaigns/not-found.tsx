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
        description="Elle a peut-être été supprimée, ou le lien est incorrect."
        action={
          <Link href="/campaigns" className={buttonVariants({ variant: "outline" })}>
            Retour aux campagnes
          </Link>
        }
      />
    </PageContainer>
  );
}

import type { Metadata } from "next";
import { PageContainer, PageHeader, StatCard } from "@/components/page-ui";
import { AgenciesTable } from "@/features/admin/components/agencies-table";
import { listAgencies, requirePlatformAdminPage } from "@/features/admin/server/admin";
import { RENEWAL_NOTICE_DAYS, daysLeft } from "@/features/subscription/subscription";
import { plural } from "@/lib/plural";

export const metadata: Metadata = { title: "Administration" };

// Espace de l'administrateur de la plateforme : toutes les agences, leur
// abonnement, et l'enregistrement des paiements reçus
export default async function AdminPage() {
  const admin = await requirePlatformAdminPage();
  const agencies = await listAgencies(admin.userId);

  const count = (s: string) => agencies.filter((a) => a.state === s).length;
  // À relancer : essais et abonnements qui se terminent dans les 7 jours
  const soon = agencies.filter(
    (a) => (a.state === "trial" || a.state === "active") && daysLeft(a.endsAt) <= RENEWAL_NOTICE_DAYS,
  ).length;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Administration"
        subtitle={`${plural(agencies.length, "agence")}. Page réservée à l'administrateur de la plateforme.`}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="En essai" value={count("trial")} />
        <StatCard label="Actives" value={count("active")} />
        <StatCard label="Expirées" value={count("expired")} />
        <StatCard label="À relancer" value={soon} hint={`fin dans ${RENEWAL_NOTICE_DAYS} jours ou moins`} />
      </div>
      <AgenciesTable
        agencies={agencies.map((a) => ({
          id: a.id,
          name: a.name,
          city: a.city,
          ownerName: a.ownerName,
          endsAt: a.endsAt,
          state: a.state,
          cases: a.cases,
        }))}
      />
    </PageContainer>
  );
}

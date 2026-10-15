import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageContainer, PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { PaymentButton } from "@/features/admin/components/payment-dialog";
import { PaymentsHistory } from "@/features/admin/components/payments-history";
import {
  listAgencies,
  listAgencyPayments,
  requirePlatformAdminPage,
} from "@/features/admin/server/admin";
import {
  STATE_LABELS,
  STATE_TONES,
  daysLeft,
  formatEndDate,
} from "@/features/subscription/subscription";
import { dayFormat } from "@/lib/dates";

export const metadata: Metadata = { title: "Agence · Administration" };

// Fiche d'une agence pour l'administrateur : abonnement et paiements
export default async function AdminAgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [agencies, payments] = await Promise.all([
    listAgencies(admin.userId),
    listAgencyPayments(id),
  ]);
  const agency = agencies.find((a) => a.id === id);
  if (!agency) notFound();
  const n = daysLeft(agency.endsAt);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-foreground">
            Administration
          </Link>
        }
        title={agency.name}
        subtitle={[agency.city, agency.ownerName && `patron : ${agency.ownerName}`, agency.phone]
          .filter(Boolean)
          .join(" · ")}
        actions={<PaymentButton agency={agency} variant="default" />}
      />

      <Panel
        title="Abonnement"
        actions={<StatusPill tone={STATE_TONES[agency.state]}>{STATE_LABELS[agency.state]}</StatusPill>}
      >
        <dl className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">
              {agency.state === "expired" ? "Expiré le" : "Fin"}
            </dt>
            <dd className="font-medium">
              {formatEndDate(agency.endsAt)}
              {agency.state !== "expired" && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {n} jour{n > 1 ? "s" : ""}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Inscrite le</dt>
            <dd className="font-medium">{dayFormat.format(new Date(agency.createdAt))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Activité</dt>
            <dd className="font-medium">
              {agency.cases} dossier{agency.cases > 1 ? "s" : ""} · {agency.members} membre
              {agency.members > 1 ? "s" : ""} actif{agency.members > 1 ? "s" : ""}
            </dd>
          </div>
        </dl>
      </Panel>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Paiements</h2>
        <PaymentsHistory
          payments={payments.map((p) => ({
            id: p.id,
            months: p.months,
            amount: p.amount,
            method: p.method,
            note: p.note,
            recordedLabel: dayFormat.format(new Date(p.recordedAt)),
            newEndsAt: p.newEndsAt,
            cancelledAt: p.cancelledAt,
            cancelReason: p.cancelReason,
          }))}
        />
      </section>
    </PageContainer>
  );
}

import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { getCase } from "@/features/cases/server/get-case";
import { PaymentsPanel } from "@/features/payments/components/payments-panel";
import { listPayments } from "@/features/payments/server/payments";
import { can } from "@/lib/permissions";
import { isReadOnly } from "@/features/subscription/server/subscription";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, member, payments] = await Promise.all([
    getCase(id),
    requireMember(),
    listPayments(id),
  ]);
  if (!data || !member) notFound();
  // Abonnement expiré : consultation seulement
  const readOnly = await isReadOnly(member.agencyId);

  return (
    <PaymentsPanel
      caseId={id}
      agreed={data.c.agreed_amount}
      paid={data.c.paid_amount}
      payments={payments}
      canCorrect={can(member, "payments_manage")}
      defaultFee={data.campaign?.default_fee ?? null}
      readOnly={readOnly}
    />
  );
}

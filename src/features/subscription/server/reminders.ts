import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/api-errors";
import { sendEmail } from "@/lib/email/send";
import { subscriptionReminderEmail, type ReminderKind } from "@/lib/email/templates";
import { siteUrl } from "@/lib/site-url";
import { reportException } from "@/lib/report-error";
import { supportPhone } from "./subscription";

type DueRow = {
  agency_id: string;
  agency_name: string;
  ends_at: string;
  state: "trial" | "active";
  kind: ReminderKind;
  email: string;
  first_name: string;
};

// Rappels de fin d'essai ou d'abonnement (7 jours et 1 jour avant), lancés
// une fois par jour (.github/workflows/rappels.yml). Chaque rappel est
// réservé dans la base avant l'envoi : jamais deux fois le même, et libéré
// si aucun e-mail n'est parti, pour le lancement suivant.
export async function sendDueReminders(): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("due_subscription_reminders");
  if (error) throw dbError("reminders", error);

  // Une agence peut avoir plusieurs patrons : un rappel, plusieurs e-mails
  const groups = new Map<string, DueRow[]>();
  for (const row of (data as DueRow[] | null) ?? []) {
    const key = `${row.agency_id}|${row.ends_at}|${row.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let sent = 0;
  let failed = 0;
  for (const rows of groups.values()) {
    const { agency_id, ends_at, kind } = rows[0];
    const reminder = { p_agency_id: agency_id, p_ends_at: ends_at, p_kind: kind };
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_subscription_reminder",
      reminder,
    );
    if (claimError) throw dbError("reminder claim", claimError);
    if (claimed !== true) continue;

    let delivered = 0;
    for (const row of rows) {
      try {
        await sendEmail({
          to: row.email,
          ...subscriptionReminderEmail({
            kind,
            trial: row.state === "trial",
            agencyName: row.agency_name,
            firstName: row.first_name,
            endsAt: ends_at,
            supportPhone: supportPhone(),
            appUrl: `${siteUrl()}/dashboard`,
          }),
          idempotencyKey: `rappel-${agency_id}-${Date.parse(ends_at)}-${kind}-${row.email}`,
        });
        delivered++;
        sent++;
      } catch (e) {
        failed++;
        reportException("[reminder email]", e);
      }
    }
    if (delivered === 0) {
      const { error: releaseError } = await admin.rpc("release_subscription_reminder", reminder);
      if (releaseError) throw dbError("reminder release", releaseError);
    }
  }
  return { sent, failed };
}

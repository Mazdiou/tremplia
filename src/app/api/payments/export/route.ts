import { safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { requireApiPermission } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildXlsx } from "@/lib/xlsx";
import { balancesSheet, collectionsSheet, overviewFileName } from "@/features/payments/overview";
import { loadPaymentsOverview } from "@/features/payments/server/overview";

// Classeur Excel de la page Paiements : la vue affichée, avec ses filtres
// (mêmes paramètres que l'adresse de la page). Patron et membres autorisés.
export function GET(request: Request) {
  return safely("payments export", async () => {
    const member = await requireApiPermission("payments_view");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const data = await loadPaymentsOverview(params);
    const view = data.filters.view;
    const sheet =
      view === "encaissements" ? collectionsSheet(data.collections ?? []) : balancesSheet(data.balances ?? []);
    const workbook = buildXlsx([sheet]);

    // Données personnelles en masse : l'export est inscrit au journal (voir
    // l'export d'une campagne)
    await logActivity(createAdminClient(), {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: "payment.exported",
      details: { view, rows: sheet.rows.length },
    });

    const fileName = overviewFileName(view, data.period.label, data.today);
    // Nom de repli sans accent pour les navigateurs qui ignorent filename*
    const ascii = fileName
      .normalize("NFD")
      .replace(/[^\x20-\x7E]|"/g, "")
      .replace(/\s+/g, " ");
    return new Response(workbook as Uint8Array<ArrayBuffer>, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  });
}

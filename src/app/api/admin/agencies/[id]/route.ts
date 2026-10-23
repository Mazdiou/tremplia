import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { deleteAgencySchema } from "@/features/admin/schemas";
import { deleteAgency, requireApiPlatformAdmin } from "@/features/admin/server/admin";

// Suppression définitive d'une agence et de tout ce qui la concerne
// (administrateur seulement, nom de l'agence retapé)
export function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("admin delete agency", async () => {
    const admin = await requireApiPlatformAdmin();
    const agencyId = parseId((await params).id);
    const { confirmName } = await parseBody(request, deleteAgencySchema);
    return ok(await deleteAgency(admin.userId, agencyId, confirmName));
  });
}

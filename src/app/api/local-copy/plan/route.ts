import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { copyPlanSchema } from "@/features/local-copy/schemas";
import { getCopyPlanData } from "@/features/local-copy/server/local-copy";

// Liste à copier sur l'ordinateur (tout membre actif). POST : jamais mis en cache.
export function POST(request: Request) {
  return safely("local copy plan", async () => {
    await requireApiMember();
    const { caseId } = await parseBody(request, copyPlanSchema);
    return ok(await getCopyPlanData(caseId));
  });
}

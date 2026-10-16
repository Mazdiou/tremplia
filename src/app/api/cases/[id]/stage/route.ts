import { ok, parseBody, safely } from "@/lib/api-errors";
import { caseStageSchema } from "@/features/stages/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { setCaseStage } from "@/features/stages/server/stages";

// Changer l'étape d'un dossier (tout membre actif)
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("cases stage", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { stageId } = await parseBody(request, caseStageSchema);
    await setCaseStage(auth, id, stageId);
    return ok();
  });
}

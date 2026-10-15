import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { uploadRequestSchema } from "@/features/documents/schemas";
import { prepareUpload } from "@/features/documents/server/documents";
import { requireWritableAgency } from "@/features/subscription/server/subscription";

// Étape 1 de l'envoi d'un PDF : URL signée vers le stockage (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("documents upload-url", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    // Avant le stockage : sinon le fichier serait envoyé puis jamais rattaché
    await requireWritableAgency(auth.agencyId);
    await parseBody(request, uploadRequestSchema);
    return ok(await prepareUpload(auth, id));
  });
}

import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { letterSchema } from "@/features/motivation-letter/schemas";
import { saveLetter } from "@/features/motivation-letter/server/letter";

// Enregistrer la lettre de motivation du dossier (tout membre actif)
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("motivation letter save", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { content } = await parseBody(request, letterSchema);
    await saveLetter(auth, id, content);
    return ok();
  });
}

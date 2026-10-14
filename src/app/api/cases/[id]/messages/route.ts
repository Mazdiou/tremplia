import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { messageSchema } from "@/features/messages/schemas";
import { sendAgencyMessage } from "@/features/messages/server/messages";

// Écrire au candidat (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("messages send", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { body } = await parseBody(request, messageSchema);
    await sendAgencyMessage(auth, id, body);
    return ok({ ok: true }, 201);
  });
}

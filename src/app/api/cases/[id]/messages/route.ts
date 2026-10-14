import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { messageSchema } from "@/features/messages/schemas";
import { latestMessageId, sendAgencyMessage } from "@/features/messages/server/messages";

// Dernier message (vérification régulière de la conversation ouverte)
export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("messages latest", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    return ok({ last: await latestMessageId(auth.agencyId, id) });
  });
}

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

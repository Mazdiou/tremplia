import { ok, parseBody, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { emailRequestSchema } from "@/features/auth/schemas";
import { requestConfirmationEmail } from "@/features/auth/server/emails";

// Nouvel e-mail de confirmation de l'adresse (route publique) : même
// réponse dans tous les cas
export function POST(request: Request) {
  return safely("confirmation", async () => {
    const { email } = await parseBody(request, emailRequestSchema);
    await requestConfirmationEmail(email, clientIp(request));
    return ok();
  });
}

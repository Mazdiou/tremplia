import { ok, parseBody, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { emailRequestSchema } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/server/emails";

// Mot de passe oublié (route publique) : même réponse que le compte existe
// ou non
export function POST(request: Request) {
  return safely("forgot-password", async () => {
    const { email } = await parseBody(request, emailRequestSchema);
    await requestPasswordReset(email, clientIp(request));
    return ok();
  });
}

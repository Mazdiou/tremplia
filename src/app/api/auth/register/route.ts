import { ok, parseBody, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { registerSchema } from "@/features/auth/schemas";
import { registerAgency } from "@/features/auth/server/accounts";

// Inscription d'une agence (route publique)
export function POST(request: Request) {
  return safely("register", async () => {
    const input = await parseBody(request, registerSchema);
    await registerAgency(input, clientIp(request));
    return ok({ ok: true }, 201);
  });
}

import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { isSignupSlug, signupSubmitSchema } from "@/features/signup/schemas";
import { submitSignup } from "@/features/signup/server/public";

type Ctx = { params: Promise<{ slug: string }> };

// Demande envoyée sur la page d'inscription en ligne d'une agence (route
// publique). Essais limités par adresse IP et par agence.
export function POST(request: Request, { params }: Ctx) {
  return safely("signup submit", async () => {
    const { slug } = await params;
    if (!isSignupSlug(slug)) throw new ApiError(404, "Page introuvable");
    const input = await parseBody(request, signupSubmitSchema);
    await submitSignup(slug, input, clientIp(request));
    return ok({ ok: true }, 201);
  });
}

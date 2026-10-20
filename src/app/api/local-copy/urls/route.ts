import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { copyUrlsSchema } from "@/features/local-copy/schemas";
import { signCopyUrls } from "@/features/local-copy/server/local-copy";

// Liens de téléchargement d'un lot de documents à copier (tout membre actif)
export function POST(request: Request) {
  return safely("local copy urls", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, copyUrlsSchema);
    return ok({ urls: await signCopyUrls(member, input) });
  });
}

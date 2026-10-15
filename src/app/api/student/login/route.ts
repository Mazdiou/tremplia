import { ok, parseBody, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { studentLoginSchema } from "@/features/student/schemas";
import { studentLogin } from "@/features/student/server/login";

// Connexion du candidat avec le code de son dossier (route publique)
export function POST(request: Request) {
  return safely("student login", async () => {
    const { code } = await parseBody(request, studentLoginSchema);
    const cookie = await studentLogin(code, clientIp(request));
    const response = ok();
    response.cookies.set(cookie);
    return response;
  });
}

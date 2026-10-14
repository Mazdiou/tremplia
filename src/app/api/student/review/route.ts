import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { studentReviewSchema } from "@/features/student/schemas";
import { getStudentSession } from "@/features/student/server/session";
import { submitReview } from "@/features/student/server/review";

// Réponse du candidat connecté : validation ou demande de modification
export function POST(request: Request) {
  return safely("student review", async () => {
    const session = await getStudentSession();
    if (!session) throw new ApiError(401, "Votre session a expiré : reconnectez-vous");
    const input = await parseBody(request, studentReviewSchema);
    await submitReview(session, input);
    return ok();
  });
}

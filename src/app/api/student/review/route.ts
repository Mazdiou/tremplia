import { ok, parseBody, safely } from "@/lib/api-errors";
import { studentReviewSchema } from "@/features/student/schemas";
import { requireApiStudent } from "@/features/student/server/session";
import { submitReview } from "@/features/student/server/review";

// Réponse du candidat connecté : validation ou demande de modification
export function POST(request: Request) {
  return safely("student review", async () => {
    const session = await requireApiStudent();
    const input = await parseBody(request, studentReviewSchema);
    await submitReview(session, input);
    return ok();
  });
}

import { ok } from "@/lib/api-errors";
import { STUDENT_COOKIE } from "@/features/student/server/session";

// Déconnexion du candidat : le cookie de session est effacé
export function POST() {
  const response = ok();
  response.cookies.delete(STUDENT_COOKIE);
  return response;
}

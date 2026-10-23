import { createHash, timingSafeEqual } from "node:crypto";

// Tâches planifiées (rappels…) : appelées avec « Authorization: Bearer
// <CRON_SECRET> », par GitHub Actions ou Vercel Cron. Sans CRON_SECRET,
// personne n'y a accès.
export function isCronAuthorized(
  authorization: string | null,
  secret = process.env.CRON_SECRET?.trim(),
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization.slice(7).trim()), digest(secret));
}

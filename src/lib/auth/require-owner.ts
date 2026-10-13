import "server-only";
import { requireMember } from "@/lib/auth/require-member";

export async function requireOwner() {
  const caller = await requireMember();
  if (!caller || caller.profile.role !== "owner") return null;
  return caller;
}

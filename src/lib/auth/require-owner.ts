import "server-only";
import { requireMember, type Member } from "@/lib/auth/require-member";

export async function requireOwner(): Promise<Member | null> {
  const member = await requireMember();
  return member?.isOwner ? member : null;
}

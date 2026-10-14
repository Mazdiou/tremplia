import { ok, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { markReadByAgency } from "@/features/messages/server/messages";

// Conversation ouverte par un membre : lue pour toute l'équipe
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("messages read", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    await markReadByAgency(auth, id);
    return ok();
  });
}

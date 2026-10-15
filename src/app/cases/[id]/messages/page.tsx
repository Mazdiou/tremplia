import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { dateTimeFormat } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { getCase } from "@/features/cases/server/get-case";
import { agencyUnreadCounts, listMessages } from "@/features/messages/server/messages";
import { MessageThread } from "@/features/messages/components/message-thread";
import { getStudentAccess } from "@/features/student/server/access";
import { isReadOnly } from "@/features/subscription/server/subscription";

export default async function CaseMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const member = await requireMember();
  if (!member) notFound();

  const [messages, unread, access, readOnly] = await Promise.all([
    listMessages(member.agencyId, id),
    agencyUnreadCounts(member.agencyId),
    getStudentAccess(member.agencyId, id),
    isReadOnly(member.agencyId),
  ]);

  return (
    <MessageThread
      viewer="agency"
      messages={messages.map((m) => ({
        ...m,
        timeLabel: dateTimeFormat.format(new Date(m.createdAt)),
      }))}
      unread={unread[id] ?? 0}
      sendUrl={`/api/cases/${id}/messages`}
      readUrl={`/api/cases/${id}/messages/read`}
      studentName={displayName(data.c.first_name, data.c.last_name)}
      agencyName="L'agence"
      emptyHint={
        access?.enabled
          ? "Écrivez au candidat : il verra vos messages dans son espace."
          : "Vous pouvez déjà écrire ; le candidat lira vos messages une fois son accès ouvert."
      }
      readOnlyNotice={
        readOnly
          ? "Abonnement expiré : la conversation reste consultable, mais vous ne pouvez plus écrire."
          : undefined
      }
    />
  );
}

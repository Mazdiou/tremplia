import { dateTimeFormat } from "@/lib/dates";
import { displayName } from "@/lib/names";
import {
  listMessages,
  studentUnreadCount,
} from "@/features/messages/server/messages";
import { MessageThread } from "@/features/messages/components/message-thread";
import { getStudentCase, requireStudent } from "@/features/student/server/student-case";
import { STUDENT_READ_ONLY } from "@/features/subscription/subscription";
import { isReadOnly } from "@/features/subscription/server/subscription";

export default async function StudentMessagesPage() {
  const session = await requireStudent();
  const [{ c, agency }, messages, unread, readOnly] = await Promise.all([
    getStudentCase(),
    listMessages(session.agencyId, session.caseId),
    studentUnreadCount(session),
    isReadOnly(session.agencyId),
  ]);

  return (
    <MessageThread
      viewer="student"
      messages={messages.map((m) => ({
        ...m,
        timeLabel: dateTimeFormat.format(new Date(m.createdAt)),
      }))}
      unread={unread}
      sendUrl="/api/student/messages"
      readUrl="/api/student/messages/read"
      studentName={displayName(c.first_name, c.last_name)}
      agencyName={agency.name}
      emptyHint={`Une question sur votre dossier ? Écrivez à ${agency.name}.`}
      readOnlyNotice={readOnly ? STUDENT_READ_ONLY : undefined}
    />
  );
}

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
import { PushDevice } from "@/features/notifications/components/push-device";
import { pushPublicKey } from "@/features/notifications/server/push";

export default async function StudentMessagesPage() {
  const session = await requireStudent();
  const [{ c, agency }, messages, unread, readOnly] = await Promise.all([
    getStudentCase(),
    listMessages(session.agencyId, session.caseId),
    studentUnreadCount(session),
    isReadOnly(session.agencyId),
  ]);

  const publicKey = pushPublicKey();

  return (
    <>
      {/* Notifications des messages de l'agence sur cet appareil */}
      {publicKey && !readOnly && (
        <section aria-label="Notifications" className="rounded-xl border bg-card p-4">
          <PushDevice
            publicKey={publicKey}
            deviceUrl="/api/student/push"
            appName="Mon dossier"
            activateLabel="Être prévenu des nouveaux messages"
            offLabel={`Recevez une notification à chaque message de ${agency.name}, même l'appli fermée.`}
            onLabel={`Vous êtes prévenu des messages de ${agency.name} sur cet appareil.`}
          />
        </section>
      )}
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
    </>
  );
}

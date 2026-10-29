"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { ofName } from "../texts";
import { PushDevice } from "./push-device";

// Espace candidat : la cloche de l'en-tête ouvre les réglages des
// notifications de cet appareil (le candidat n'a pas de page Réglages)
export function StudentNotificationsButton({
  publicKey,
  owner,
  agencyName,
}: {
  publicKey: string;
  owner: string;
  agencyName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useModalDialog(open);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-xl text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell />
      </Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        aria-labelledby="student-notifications-title"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="student-notifications-title" className="text-base font-semibold">
              Notifications
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Soyez prévenu sur ce téléphone de chaque message {ofName(agencyName)}, même l&apos;application fermée.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-1 shrink-0"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X />
          </Button>
        </div>
        {open && <StudentPushDevice publicKey={publicKey} owner={owner} agencyName={agencyName} />}
      </dialog>
    </>
  );
}

export function StudentPushDevice({
  publicKey,
  owner,
  agencyName,
}: {
  publicKey: string;
  owner: string;
  agencyName: string;
}) {
  return (
    <PushDevice
      publicKey={publicKey}
      deviceUrl="/api/student/push"
      testUrl="/api/student/push/test"
      appName="Mon dossier"
      owner={owner}
      activateLabel="Être prévenu des nouveaux messages"
      offLabel={`Recevez une notification à chaque message ${ofName(agencyName)}, même l'application fermée.`}
      onLabel={`Vous êtes prévenu des messages ${ofName(agencyName)} sur cet appareil.`}
    />
  );
}

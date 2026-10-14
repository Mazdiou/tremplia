"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

type Status = "active" | "closed" | "abandoned";

type Action = {
  to: Status;
  label: string;
  title: string | null;
  body: string | null;
  confirmLabel: string;
};

const ACTIONS: Record<Status, Action[]> = {
  active: [
    {
      to: "closed",
      label: "Clore",
      title: "Clore ce dossier ?",
      body: "Le dossier disparaît de l'arbre. Vous pourrez le rouvrir à tout moment.",
      confirmLabel: "Clore le dossier",
    },
    {
      to: "abandoned",
      label: "Abandonner",
      title: "Marquer ce dossier comme abandonné ?",
      body: "Le dossier disparaît de l'arbre. Vous pourrez le rouvrir à tout moment.",
      confirmLabel: "Abandonner le dossier",
    },
  ],
  closed: [
    { to: "active", label: "Rouvrir", title: null, body: null, confirmLabel: "" },
  ],
  abandoned: [
    { to: "active", label: "Rouvrir", title: null, body: null, confirmLabel: "" },
  ],
};

export function CaseStatusButtons({
  id,
  status,
}: {
  id: string;
  status: Status;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function change(to: Status) {
    setError(null);
    setLoading(true);
    const res = await callApi(`/api/cases/${id}/status`, {
      method: "PATCH",
      body: { status: to },
    });
    setLoading(false);
    dialogRef.current?.close();
    setPending(null);
    if (!res.ok) setError(res.error);
    // Recharge l'arbre (compteurs, dossiers masqués) et la fiche
    router.refresh();
  }

  function ask(a: Action) {
    if (!a.title) return void change(a.to);
    setPending(a);
    dialogRef.current?.showModal();
  }

  function dismiss() {
    dialogRef.current?.close();
    setPending(null);
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          {ACTIONS[status].map((a) => (
            <Button
              key={a.to}
              variant="outline"
              disabled={loading}
              onClick={() => ask(a)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        {error && (
          <p className="max-w-xs text-right text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Boîte de confirmation : <dialog> natif (Échap, focus piégé, fond) */}
      <dialog
        ref={dialogRef}
        onClose={() => setPending(null)}
        onClick={(e) => e.target === dialogRef.current && dismiss()}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
      >
        {pending && (
          <>
            <h2 className="text-base font-semibold">{pending.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {pending.body}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={dismiss} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={() => change(pending.to)} disabled={loading}>
                {loading ? "Patientez..." : pending.confirmLabel}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

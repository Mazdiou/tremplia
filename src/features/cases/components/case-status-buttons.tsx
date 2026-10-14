"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { CaseStatus } from "@/features/cases/labels";
import { callApi } from "@/lib/api-client";

type Action = {
  to: CaseStatus;
  label: string;
  // Absent : action immédiate, sans confirmation
  confirm?: { title: string; body: string; label: string };
};

const HIDDEN_FROM_TREE =
  "Le dossier disparaît de l'arbre. Vous pourrez le rouvrir à tout moment.";

const ACTIONS: Record<CaseStatus, Action[]> = {
  active: [
    {
      to: "closed",
      label: "Clore",
      confirm: { title: "Clore ce dossier ?", body: HIDDEN_FROM_TREE, label: "Clore le dossier" },
    },
    {
      to: "abandoned",
      label: "Abandonner",
      confirm: {
        title: "Marquer ce dossier comme abandonné ?",
        body: HIDDEN_FROM_TREE,
        label: "Abandonner le dossier",
      },
    },
  ],
  closed: [{ to: "active", label: "Rouvrir" }],
  abandoned: [{ to: "active", label: "Rouvrir" }],
};

export function CaseStatusButtons({
  id,
  status,
}: {
  id: string;
  status: CaseStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(to: CaseStatus) {
    setError(null);
    setLoading(true);
    const res = await callApi(`/api/cases/${id}/status`, {
      method: "PATCH",
      body: { status: to },
    });
    setLoading(false);
    setPending(null);
    if (!res.ok) setError(res.error);
    // Recharge l'arbre (compteurs, dossiers masqués) et la fiche
    router.refresh();
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
              onClick={() => (a.confirm ? setPending(a) : void change(a.to))}
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

      <ConfirmDialog
        open={pending !== null}
        title={pending?.confirm?.title ?? ""}
        body={pending?.confirm?.body ?? ""}
        confirmLabel={pending?.confirm?.label ?? ""}
        loading={loading}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void change(pending.to)}
      />
    </>
  );
}

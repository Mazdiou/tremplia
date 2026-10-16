"use client";

import { useRef, useState } from "react";
import { MoreHorizontal, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { CaseStatus } from "@/features/cases/labels";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/hooks/use-dismiss";
import { MENU_ITEM_CLASS } from "@/components/page-ui";

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
      label: "Clore le dossier",
      confirm: { title: "Clore ce dossier ?", body: HIDDEN_FROM_TREE, label: "Clore le dossier" },
    },
    {
      to: "abandoned",
      label: "Marquer abandonné",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismiss(menuRef, menuOpen, setMenuOpen);

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

  const actions = ACTIONS[status];
  // Dossier actif : clore ou abandonner, rares et confirmés, dans un menu.
  // Sinon, « Rouvrir » reste visible : c'est la seule action utile.
  const asMenu = status === "active";

  return (
    <>
      <div className="relative" ref={menuRef}>
        {asMenu ? (
          <Button
            variant="outline"
            size="icon"
            aria-label="Autres actions sur le dossier"
            title="Autres actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={loading}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreHorizontal />
          </Button>
        ) : (
          actions.map((a) => (
            <Button key={a.to} variant="outline" disabled={loading} onClick={() => void change(a.to)}>
              <RotateCcw /> {a.label}
            </Button>
          ))
        )}
        {menuOpen && (
          <div
            role="menu"
            className="absolute top-11 right-0 z-30 w-48 rounded-xl border bg-popover p-1 shadow-lg"
          >
            {actions.map((a) => (
              <button
                key={a.to}
                role="menuitem"
                type="button"
                className={cn(MENU_ITEM_CLASS, a.to === "abandoned" && "text-destructive")}
                onClick={() => {
                  setMenuOpen(false);
                  if (a.confirm) setPending(a);
                  else void change(a.to);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="absolute top-11 right-0 w-64 text-right text-xs text-destructive" role="alert">
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

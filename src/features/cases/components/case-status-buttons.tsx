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
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { pluralWord } from "@/lib/plural";
import { TaskForm } from "@/features/tasks/components/task-form";
import type { TaskFormContext } from "@/features/tasks/types";

type Action = {
  to: CaseStatus;
  label: string;
  // Absent : action immédiate, sans confirmation
  confirm?: { title: string; body: string; label: string };
};

const HIDDEN_FROM_TREE =
  "Il disparaît de la liste. Vous pourrez le rouvrir à tout moment.";

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
  openTasks,
  taskContext,
}: {
  id: string;
  status: CaseStatus;
  // Tâches à faire : proposées à la clôture pour être marquées faites
  openTasks: number;
  taskContext: TaskFormContext;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [completeTasks, setCompleteTasks] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const taskDialogRef = useModalDialog(addingTask);

  useDismiss(menuRef, menuOpen, setMenuOpen);

  async function change(to: CaseStatus) {
    setError(null);
    setLoading(true);
    const res = await callApi(`/api/cases/${id}/status`, {
      method: "PATCH",
      body: { status: to, completeTasks: to !== "active" && openTasks > 0 && completeTasks },
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
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM_CLASS}
              onClick={() => {
                setMenuOpen(false);
                setAddingTask(true);
              }}
            >
              Ajouter une tâche
            </button>
            <div role="separator" className="my-1 border-t" />
            {actions.map((a) => (
              <button
                key={a.to}
                role="menuitem"
                type="button"
                className={cn(MENU_ITEM_CLASS, a.to === "abandoned" && "text-destructive")}
                onClick={() => {
                  setMenuOpen(false);
                  setCompleteTasks(true);
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
      >
        {openTasks > 0 && (
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={completeTasks}
              onChange={(e) => setCompleteTasks(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              {openTasks > 1
                ? `Marquer faites les ${openTasks} tâches à faire`
                : "Marquer faite la tâche à faire"}
              <span className="block text-xs text-muted-foreground">
                Sinon, {pluralWord(openTasks, "elle reste", "elles restent")} dans la liste des tâches.
              </span>
            </span>
          </label>
        )}
      </ConfirmDialog>

      {/* Raccourci : une tâche sans quitter l'onglet ouvert */}
      <dialog
        ref={taskDialogRef}
        onClose={() => setAddingTask(false)}
        onClick={(e) => e.target === taskDialogRef.current && setAddingTask(false)}
        aria-labelledby="quick-task-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
      >
        <h2 id="quick-task-title" className="mb-4 text-base font-semibold">
          Nouvelle tâche
        </h2>
        {addingTask && (
          <TaskForm
            context={taskContext}
            autoFocus
            onSaved={() => {
              setAddingTask(false);
              router.refresh();
            }}
            onCancel={() => setAddingTask(false)}
          />
        )}
      </dialog>
    </>
  );
}

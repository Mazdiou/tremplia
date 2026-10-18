"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MENU_ITEM_CLASS, StatusPill } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { dueLabel, dueState, quickDueDates } from "@/features/tasks/due";
import { TaskForm } from "@/features/tasks/components/task-form";
import type { TaskMember, TaskItem } from "@/features/tasks/types";

export type TaskListProps = {
  tasks: TaskItem[];
  members: TaskMember[];
  currentUserId: string;
  // Jour de l'application (AAAA-MM-JJ), calculé par le serveur
  today: string;
  readOnly: boolean;
  // Résultat d'une action (« Tâche reportée… », erreur)
  onMessage: (text: string, error?: boolean) => void;
  // Page Tâches : responsable affiché sur chaque ligne (vue de l'équipe)
  showAssignee?: boolean;
  className?: string;
};

// Liste de tâches : cocher / rouvrir, modifier, reporter, supprimer. Sert à
// l'onglet d'un dossier et à la page Tâches (avec le nom du candidat).
export function TaskList({
  tasks,
  members,
  currentUserId,
  today,
  readOnly,
  onMessage,
  showAssignee = true,
  className,
}: TaskListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Cochées ou rouvertes, en attente du serveur : affichées dans leur nouvel
  // état tout de suite (identifiant → faite ?)
  const [toggling, setToggling] = useState<Map<string, boolean>>(new Map());
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const url = (t: TaskItem) => `/api/cases/${t.caseId}/tasks/${t.id}`;

  async function toggle(task: TaskItem, done: boolean) {
    setToggling((m) => new Map(m).set(task.id, done));
    const res = await callApi(`${url(task)}/done`, { method: "PUT", body: { done } });
    if (!res.ok) onMessage(res.error, true);
    router.refresh();
    // Laisse au rafraîchissement le temps d'arriver avant de rendre la main
    setTimeout(
      () =>
        setToggling((m) => {
          const next = new Map(m);
          next.delete(task.id);
          return next;
        }),
      res.ok ? 600 : 0,
    );
  }

  async function postpone(task: TaskItem, dueDate: string) {
    const res = await callApi(url(task), {
      method: "PATCH",
      body: { title: task.title, details: task.details ?? "", dueDate, assignedTo: task.assignedTo },
    });
    if (!res.ok) onMessage(res.error, true);
    else onMessage(`Tâche reportée à ${dueLabel(dueDate, today)}`);
    router.refresh();
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await callApi(url(deleteTarget), { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) onMessage(res.error, true);
    else onMessage("Tâche supprimée");
    router.refresh();
  }

  if (tasks.length === 0) return null;

  return (
    <>
      <ul className={cn("divide-y rounded-xl border bg-card", className)}>
        {tasks.map((t) =>
          editingId === t.id ? (
            <li key={t.id} className="p-4">
              <TaskForm
                context={{ caseId: t.caseId, members, currentUserId, today }}
                task={t}
                autoFocus
                onSaved={(text) => {
                  setEditingId(null);
                  onMessage(text);
                  router.refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <TaskRow
              key={t.id}
              task={t}
              done={toggling.get(t.id) ?? t.doneLabel !== null}
              currentUserId={currentUserId}
              today={today}
              readOnly={readOnly}
              showAssignee={showAssignee}
              onToggle={(done) => void toggle(t, done)}
              onEdit={() => setEditingId(t.id)}
              onPostpone={(d) => void postpone(t, d)}
              onDelete={() => setDeleteTarget(t)}
            />
          ),
        )}
      </ul>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer cette tâche ?"
        body={deleteTarget ? `« ${deleteTarget.title} » sera supprimée définitivement.` : ""}
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function DueBadge({ dueDate, today }: { dueDate: string | null; today: string }) {
  if (!dueDate) return null;
  const label = dueLabel(dueDate, today);
  const state = dueState(dueDate, today);
  if (state === "overdue") return <StatusPill tone="bad">En retard · {label}</StatusPill>;
  if (state === "today") return <StatusPill tone="warn">Aujourd&apos;hui</StatusPill>;
  return <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span>;
}

function TaskRow({
  task,
  done,
  currentUserId,
  today,
  readOnly,
  showAssignee,
  onToggle,
  onEdit,
  onPostpone,
  onDelete,
}: {
  task: TaskItem;
  // État affiché (déjà le nouvel état pendant l'envoi)
  done: boolean;
  currentUserId: string;
  today: string;
  readOnly: boolean;
  showAssignee: boolean;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onPostpone: (dueDate: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menuOpen, setMenuOpen);

  const mine = task.assignedTo === currentUserId;
  const canToggle = task.canEdit && !readOnly;
  const isDoneTask = task.doneLabel !== null;
  const showMenu = !readOnly && (task.canEdit || task.canDelete);
  const meta = isDoneTask
    ? task.doneLabel
    : [showAssignee ? (mine ? "Moi" : task.assigneeName) : null, task.creatorName && `créée par ${task.creatorName}`]
        .filter(Boolean)
        .join(" · ");

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Rouvrir « ${task.title} »` : `Marquer « ${task.title} » comme faite`}
        title={canToggle ? (done ? "Rouvrir" : "Marquer comme faite") : undefined}
        disabled={!canToggle}
        onClick={() => onToggle(!isDoneTask)}
        className={cn(
          "touch-target mt-0.5 grid size-5 shrink-0 touch-manipulation place-items-center rounded-full border-2 transition-colors disabled:cursor-default",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary",
          !canToggle && !done && "opacity-50",
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("font-medium break-words", done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        {task.caseLabel && (
          <p className="mt-0.5 text-xs">
            <Link
              href={`/cases/${task.caseId}/tasks`}
              className="font-medium text-link underline-offset-2 hover:underline"
            >
              {task.caseLabel.name}
            </Link>
            <span className="text-muted-foreground"> · {task.caseLabel.detail}</span>
          </p>
        )}
        {task.details && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{task.details}</p>
        )}
        {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
        {/* Téléphone : l'échéance sous le titre, qui garde toute la largeur */}
        {!isDoneTask && !done && task.dueDate && (
          <div className="mt-1.5 sm:hidden">
            <DueBadge dueDate={task.dueDate} today={today} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!isDoneTask && !done && (
          <span className="max-sm:hidden">
            <DueBadge dueDate={task.dueDate} today={today} />
          </span>
        )}
        {showMenu && (
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions sur « ${task.title} »`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal />
            </Button>
            {menuOpen && (
              <div role="menu" className="absolute top-9 right-0 z-30 w-52 rounded-xl border bg-popover p-1 shadow-lg">
                {task.canEdit && (
                  <button
                    role="menuitem"
                    type="button"
                    className={MENU_ITEM_CLASS}
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                  >
                    Modifier
                  </button>
                )}
                {task.canEdit && !isDoneTask && (
                  <>
                    <p className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground">Reporter à</p>
                    {quickDueDates(today)
                      .slice(1)
                      .map((q) => (
                        <button
                          key={q.label}
                          role="menuitem"
                          type="button"
                          className={cn(MENU_ITEM_CLASS, "pl-5")}
                          onClick={() => {
                            setMenuOpen(false);
                            onPostpone(q.date);
                          }}
                        >
                          {q.label}
                        </button>
                      ))}
                  </>
                )}
                {task.canDelete && (
                  <button
                    role="menuitem"
                    type="button"
                    className={cn(MENU_ITEM_CLASS, "text-destructive")}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

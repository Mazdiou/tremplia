"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ListTodo, MoreHorizontal, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MENU_ITEM_CLASS, StatusMessage, StatusPill, type ActionMessage } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";
import { callApi } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { dueLabel, dueState, quickDueDates } from "@/features/tasks/due";
import { TaskForm } from "@/features/tasks/components/task-form";
import type { TaskFormContext, TaskItem } from "@/features/tasks/types";

// Onglet Tâches d'un dossier : les tâches à faire (en retard d'abord), puis
// les dernières faites, repliées.
export function TasksPanel({
  context,
  open,
  done,
  doneTotal,
  readOnly,
}: {
  context: TaskFormContext;
  open: TaskItem[];
  done: TaskItem[];
  doneTotal: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);
  // Cochées ou rouvertes, en attente du serveur : affichées dans leur nouvel
  // état tout de suite (identifiant → faite ?)
  const [toggling, setToggling] = useState<Map<string, boolean>>(new Map());
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const base = `/api/cases/${context.caseId}/tasks`;
  const say = (text: string, error = false) => setMessage({ text, error });

  function saved(text: string) {
    setAdding(false);
    setEditingId(null);
    say(text);
    router.refresh();
  }

  async function toggle(task: TaskItem, done: boolean) {
    setMessage(null);
    setToggling((m) => new Map(m).set(task.id, done));
    const res = await callApi(`${base}/${task.id}/done`, { method: "PUT", body: { done } });
    if (!res.ok) say(res.error, true);
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
    setMessage(null);
    const res = await callApi(`${base}/${task.id}`, {
      method: "PATCH",
      body: { title: task.title, details: task.details ?? "", dueDate, assignedTo: task.assignedTo },
    });
    if (!res.ok) say(res.error, true);
    else say(`Tâche reportée à ${dueLabel(dueDate, context.today)}`);
    router.refresh();
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await callApi(`${base}/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) say(res.error, true);
    else say("Tâche supprimée");
    router.refresh();
  }

  const rowProps = {
    context,
    readOnly,
    editingId,
    onEdit: (id: string) => {
      setMessage(null);
      setAdding(false);
      setEditingId(id);
    },
    onCancelEdit: () => setEditingId(null),
    onSaved: saved,
    onPostpone: (t: TaskItem, d: string) => void postpone(t, d),
    onDelete: (t: TaskItem) => setDeleteTarget(t),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {open.length === 0 ? "Rien à faire" : `${plural(open.length, "tâche")} à faire`}
        </h2>
        {!readOnly && !adding && (
          <Button
            size="sm"
            onClick={() => {
              setMessage(null);
              setEditingId(null);
              setAdding(true);
            }}
          >
            <Plus /> Nouvelle tâche
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Nouvelle tâche</h3>
          <TaskForm context={context} autoFocus onSaved={saved} onCancel={() => setAdding(false)} />
        </div>
      )}

      <StatusMessage message={message} />

      {open.length === 0 && !adding ? (
        <div className="rounded-xl border px-6 py-10 text-center">
          <ListTodo className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">Aucune tâche à faire</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Notez ici ce qu&apos;il reste à faire pour ce candidat, avec une date et la personne
            qui s&apos;en charge.
          </p>
        </div>
      ) : (
        open.length > 0 && (
          <ul className="divide-y rounded-xl border bg-card">
            {open.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                done={toggling.get(t.id) ?? false}
                onToggle={() => void toggle(t, true)}
                {...rowProps}
              />
            ))}
          </ul>
        )
      )}

      {doneTotal > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((s) => !s)}
            className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn("size-4 transition-transform", showDone && "rotate-90")} aria-hidden />
            Faites ({doneTotal})
          </button>
          {showDone && (
            <>
              <ul className="mt-2 divide-y rounded-xl border">
                {done.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    done={toggling.get(t.id) ?? true}
                    onToggle={() => void toggle(t, false)}
                    {...rowProps}
                  />
                ))}
              </ul>
              {doneTotal > done.length && (
                <p className="mt-2 px-1 text-xs text-muted-foreground">
                  Seules les {done.length} dernières tâches faites sont affichées.
                </p>
              )}
            </>
          )}
        </div>
      )}

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
    </div>
  );
}

function DueBadge({ dueDate, today, done }: { dueDate: string | null; today: string; done: boolean }) {
  if (!dueDate) return null;
  const label = dueLabel(dueDate, today);
  const state = done ? "later" : dueState(dueDate, today);
  if (state === "overdue") return <StatusPill tone="bad">En retard · {label}</StatusPill>;
  if (state === "today") return <StatusPill tone="warn">Aujourd&apos;hui</StatusPill>;
  return <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span>;
}

function TaskRow({
  task,
  done,
  context,
  readOnly,
  editingId,
  onToggle,
  onEdit,
  onCancelEdit,
  onSaved,
  onPostpone,
  onDelete,
}: {
  task: TaskItem;
  done: boolean;
  context: TaskFormContext;
  readOnly: boolean;
  editingId: string | null;
  onToggle: () => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaved: (message: string) => void;
  onPostpone: (task: TaskItem, dueDate: string) => void;
  onDelete: (task: TaskItem) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menuOpen, setMenuOpen);

  if (editingId === task.id) {
    return (
      <li className="p-4">
        <TaskForm context={context} task={task} autoFocus onSaved={onSaved} onCancel={onCancelEdit} />
      </li>
    );
  }

  const mine = task.assignedTo === context.currentUserId;
  const canToggle = task.canEdit && !readOnly;
  const isDoneTask = task.doneLabel !== null;
  const showMenu = !readOnly && (task.canEdit || task.canDelete);

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Rouvrir « ${task.title} »` : `Marquer « ${task.title} » comme faite`}
        title={canToggle ? (done ? "Rouvrir" : "Marquer comme faite") : undefined}
        disabled={!canToggle}
        onClick={onToggle}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 touch-manipulation place-items-center rounded-full border-2 transition-colors disabled:cursor-default",
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
        {task.details && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{task.details}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {isDoneTask ? (
            task.doneLabel
          ) : (
            <>
              {mine ? "Moi" : task.assigneeName}
              {task.creatorName && ` · créée par ${task.creatorName}`}
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!isDoneTask && <DueBadge dueDate={task.dueDate} today={context.today} done={done} />}
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
                      onEdit(task.id);
                    }}
                  >
                    Modifier
                  </button>
                )}
                {task.canEdit && !isDoneTask && (
                  <>
                    <p className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground">Reporter à</p>
                    {quickDueDates(context.today)
                      .slice(1)
                      .map((q) => (
                        <button
                          key={q.label}
                          role="menuitem"
                          type="button"
                          className={cn(MENU_ITEM_CLASS, "pl-5")}
                          onClick={() => {
                            setMenuOpen(false);
                            onPostpone(task, q.date);
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
                      onDelete(task);
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ListTodo, Plus } from "lucide-react";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { TaskForm } from "@/features/tasks/components/task-form";
import { TaskList } from "@/features/tasks/components/task-list";
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
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);

  const say = (text: string, error = false) => setMessage({ text, error });
  const listProps = {
    members: context.members,
    currentUserId: context.currentUserId,
    today: context.today,
    readOnly,
    onMessage: say,
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
          <TaskForm
            context={context}
            autoFocus
            onSaved={(text) => {
              setAdding(false);
              say(text);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
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
        <TaskList tasks={open} {...listProps} />
      )}

      {doneTotal > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((s) => !s)}
            className="flex min-h-9 items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn("size-4 transition-transform", showDone && "rotate-90")} aria-hidden />
            Faites ({doneTotal})
          </button>
          {showDone && (
            <>
              <TaskList tasks={done} {...listProps} className="mt-2 bg-transparent" />
              {doneTotal > done.length && (
                <p className="mt-2 px-1 text-xs text-muted-foreground">
                  Seules les {done.length} dernières tâches faites sont affichées.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

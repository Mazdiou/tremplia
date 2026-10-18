"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { cn } from "@/lib/utils";
import { TaskList } from "@/features/tasks/components/task-list";
import type { TaskItem, TaskMember } from "@/features/tasks/types";

export type TaskSection = {
  key: string;
  title: string;
  tasks: TaskItem[];
  // Replié d'emblée (plus tard, sans échéance, faites)
  collapsed?: boolean;
  tone?: "bad" | "warn";
};

const TONES = { bad: "text-destructive", warn: "text-amber-700 dark:text-amber-300" };

// Page Tâches : les sections (en retard, aujourd'hui…) d'une même liste
export function TasksOverview({
  sections,
  members,
  currentUserId,
  today,
  readOnly,
  showAssignee,
}: {
  sections: TaskSection[];
  members: TaskMember[];
  currentUserId: string;
  today: string;
  readOnly: boolean;
  showAssignee: boolean;
}) {
  const [message, setMessage] = useState<ActionMessage>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      <StatusMessage message={message} className="-my-3" />
      {sections
        .filter((s) => s.tasks.length > 0)
        .map((s) => {
          const expanded = open[s.key] ?? !s.collapsed;
          return (
            <section key={s.key} aria-labelledby={`section-${s.key}`}>
              <h2 id={`section-${s.key}`}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen((o) => ({ ...o, [s.key]: !expanded }))}
                  className={cn(
                    "flex min-h-9 items-center gap-1 rounded-md text-xs font-semibold tracking-wide uppercase",
                    s.tone ? TONES[s.tone] : "text-muted-foreground",
                  )}
                >
                  <ChevronRight
                    className={cn("size-4 transition-transform", expanded && "rotate-90")}
                    aria-hidden
                  />
                  {s.title} · {s.tasks.length}
                </button>
              </h2>
              {expanded && (
                <TaskList
                  tasks={s.tasks}
                  members={members}
                  currentUserId={currentUserId}
                  today={today}
                  readOnly={readOnly}
                  showAssignee={showAssignee}
                  onMessage={(text, error = false) => setMessage({ text, error })}
                  className="mt-2"
                />
              )}
            </section>
          );
        })}
    </div>
  );
}

// Filtres de la page : personne et campagne, passés dans l'adresse
// (identifiants seulement, aucune donnée personnelle)
export function TasksFilters({
  who,
  campaign,
  members,
  campaigns,
  currentUserId,
}: {
  who: string;
  campaign: string;
  members: TaskMember[];
  campaigns: { id: string; name: string; archived: boolean }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const go = (next: { who?: string; campaign?: string }) => {
    const q = new URLSearchParams();
    const w = next.who ?? who;
    const c = next.campaign ?? campaign;
    if (w !== "moi") q.set("qui", w);
    if (c) q.set("campagne", c);
    const query = q.toString();
    router.push(query ? `/tasks?${query}` : "/tasks");
  };
  const selectClass =
    "h-10 min-w-0 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:flex-1";

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <select
        aria-label="Tâches de"
        value={who}
        onChange={(e) => go({ who: e.target.value })}
        className={selectClass}
      >
        <option value="moi">Mes tâches</option>
        <option value="equipe">Toute l&apos;équipe</option>
        {members
          .filter((m) => m.id !== currentUserId && (m.isActive || m.id === who))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.isActive ? "" : " (désactivé)"}
            </option>
          ))}
      </select>
      <select
        aria-label="Campagne"
        value={campaign}
        onChange={(e) => go({ campaign: e.target.value })}
        className={selectClass}
      >
        <option value="">Campagnes actives</option>
        <option value="toutes">Toutes, archivées comprises</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.archived ? " (archivée)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

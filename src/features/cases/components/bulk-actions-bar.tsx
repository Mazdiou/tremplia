"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { BULK_MAX_CASES } from "@/features/cases/schemas";
import type { TreeCase } from "@/features/cases/fetch-campaign-cases";
import type { CampaignStage } from "@/features/stages/stages";
import { TaskForm } from "@/features/tasks/components/task-form";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { callApi } from "@/lib/api-client";
import { todayInAppTimezone } from "@/lib/dates";
import { fullName } from "@/lib/names";
import { plural } from "@/lib/plural";
import type { TreeMember } from "./case-tree";

type Pending =
  | { type: "stage"; id: string; name: string }
  | { type: "assignee"; id: string; name: string };

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

// Barre des actions groupées, en bas de l'arbre en mode sélection : même
// étape (dossiers d'une seule campagne), même responsable (patron
// seulement) ou même tâche pour tous les dossiers cochés.
export function BulkActionsBar({
  selected,
  stages,
  members,
  currentUserId,
  isOwner,
  onClear,
  onExit,
}: {
  selected: TreeCase[];
  // Étapes de toutes les campagnes de l'agence
  stages: CampaignStage[];
  members: TreeMember[];
  currentUserId: string;
  isOwner: boolean;
  onClear: () => void;
  onExit: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);
  // Fenêtre « Ajouter une tâche » : jour de l'application fixé à l'ouverture
  const [taskToday, setTaskToday] = useState<string | null>(null);
  const taskDialogRef = useModalDialog(taskToday !== null);
  const created = useRef(0);

  const count = selected.length;
  const campaignIds = new Set(selected.map((c) => c.campaign_id));
  const campaignStages =
    campaignIds.size === 1
      ? stages
          .filter((s) => s.campaign_id === [...campaignIds][0])
          .sort((a, b) => a.position - b.position)
      : [];
  const stageHint =
    count === 0
      ? null
      : campaignIds.size > 1
        ? "Étape : choisissez des dossiers d'une seule campagne."
        : campaignStages.length === 0
          ? "Cette campagne n'a pas d'étape."
          : null;
  const tooMany = count > BULK_MAX_CASES;

  async function apply() {
    if (!pending) return;
    setSaving(true);
    setMessage(null);
    const res = await callApi<{ changed: number }>("/api/cases/bulk", {
      body: {
        caseIds: selected.map((c) => c.id),
        action:
          pending.type === "stage"
            ? { type: "stage", stageId: pending.id }
            : { type: "assignee", assignedTo: pending.id },
      },
    });
    setSaving(false);
    setPending(null);
    if (!res.ok) {
      setMessage({ text: res.error, error: true });
      return;
    }
    const changed = res.data.changed;
    setMessage({
      text:
        changed === 0
          ? "Ces dossiers étaient déjà à jour."
          : plural(changed, "dossier mis à jour", "dossiers mis à jour"),
      error: false,
    });
    onClear();
    router.refresh();
  }


  return (
    <div className="space-y-2 border-t bg-sidebar p-4">
      {/* Compteur et « Tout décocher » empilés : tient sur une ligne même
          quand le panneau est à sa largeur minimale */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" aria-live="polite">
            {count === 0 ? "Aucun dossier coché" : plural(count, "sélectionné")}
          </p>
          {count > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Tout décocher
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Cochez-les dans la liste</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onExit} className="shrink-0">
          Terminer
        </Button>
      </div>

      {tooMany && (
        <p className="text-xs text-destructive">
          {BULK_MAX_CASES} dossiers au plus à la fois.
        </p>
      )}

      <select
        value=""
        disabled={count === 0 || tooMany || campaignStages.length === 0}
        onChange={(e) => {
          const stage = campaignStages.find((s) => s.id === e.target.value);
          if (stage) setPending({ type: "stage", id: stage.id, name: stage.name });
        }}
        aria-label="Changer l'étape des dossiers sélectionnés"
        className={selectClass}
      >
        <option value="">Changer l&apos;étape…</option>
        {campaignStages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {stageHint && <p className="text-xs text-muted-foreground">{stageHint}</p>}

      <Button
        variant="outline"
        size="sm"
        disabled={count === 0 || tooMany}
        onClick={() => {
          setMessage(null);
          setTaskToday(todayInAppTimezone());
        }}
        className="w-full justify-start"
      >
        <ListTodo /> Ajouter une tâche…
      </Button>

      {isOwner && (
        <select
          value=""
          disabled={count === 0 || tooMany}
          onChange={(e) => {
            const m = members.find((x) => x.id === e.target.value);
            if (m) {
              setPending({ type: "assignee", id: m.id, name: fullName(m.first_name, m.last_name) });
            }
          }}
          aria-label="Confier les dossiers sélectionnés à"
          className={selectClass}
        >
          <option value="">Confier à…</option>
          {members
            .filter((m) => m.is_active)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {fullName(m.first_name, m.last_name)}
              </option>
            ))}
        </select>
      )}

      <StatusMessage message={message} />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.type === "stage" ? "Changer l'étape" : "Changer le responsable"}
        body={
          pending?.type === "stage"
            ? `Passer ${plural(count, "dossier")} à l'étape « ${pending.name} » ?`
            : `Confier ${plural(count, "dossier")} à ${pending?.name ?? ""} ?`
        }
        confirmLabel="Appliquer"
        loading={saving}
        onConfirm={() => void apply()}
        onCancel={() => setPending(null)}
      />

      <dialog
        ref={taskDialogRef}
        onClose={() => setTaskToday(null)}
        onClick={(e) => e.target === taskDialogRef.current && setTaskToday(null)}
        aria-labelledby="bulk-task-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
      >
        <h2 id="bulk-task-title" className="text-base font-semibold">
          Même tâche pour {plural(count, "dossier")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Une tâche distincte est ajoutée à chaque dossier coché.
        </p>
        {taskToday && (
          <TaskForm
            context={{
              caseId: "",
              members: members.map((m) => ({
                id: m.id,
                name: fullName(m.first_name, m.last_name),
                isActive: m.is_active,
              })),
              currentUserId,
              today: taskToday,
            }}
            autoFocus
            submitLabel={`Ajouter à ${plural(count, "dossier")}`}
            save={async (task) => {
              const res = await callApi<{ changed: number }>("/api/cases/bulk", {
                body: { caseIds: selected.map((c) => c.id), action: { type: "task", task } },
              });
              if (res.ok) created.current = res.data.changed;
              return res;
            }}
            onSaved={() => {
              setTaskToday(null);
              setMessage({
                text: `Tâche ajoutée à ${plural(created.current, "dossier")}`,
                error: false,
              });
              onClear();
              router.refresh();
            }}
            onCancel={() => setTaskToday(null)}
          />
        )}
      </dialog>
    </div>
  );
}

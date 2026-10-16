"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callApi } from "@/lib/api-client";
import { MAX_STAGES } from "../schemas";
import { removalTargets } from "../stages";
import { plural } from "@/lib/plural";

export type StageWithCounts = {
  id: string;
  name: string;
  // Dossiers actifs à cette étape, et tous statuts confondus
  activeCases: number;
  cases: number;
};

type DraftStage = { key: string; id: string | null; name: string };

// Étapes d'une campagne : avancement des dossiers actifs pour toute
// l'équipe, et modification de la liste par le patron (campagne active).
export function CampaignStages({
  campaignId,
  stages,
  canEdit,
}: {
  campaignId: string;
  stages: StageWithCounts[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftStage[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const maxActive = Math.max(1, ...stages.map((s) => s.activeCases));

  function startEdit() {
    setError(null);
    setFieldErrors({});
    setDraft(stages.map((s) => ({ key: s.id, id: s.id, name: s.name })));
  }

  // Dossiers déplacés par les étapes retirées, pour la confirmation
  function moves(d: DraftStage[]) {
    const targets = removalTargets(
      stages.map((s) => s.id),
      d.map((s) => s.id),
    );
    return stages
      .filter((s) => targets.has(s.id) && s.cases > 0)
      .map((s) => ({
        from: s.name,
        to: d[targets.get(s.id) ?? 0]?.name.trim() || "la première étape",
        cases: s.cases,
      }));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const res = await callApi(`/api/campaigns/${campaignId}/stages`, {
      method: "PUT",
      body: { stages: draft.map(({ id, name }) => ({ id, name })) },
    });
    setSaving(false);
    setConfirming(false);
    if (!res.ok) {
      setError(res.error);
      setFieldErrors(res.fieldErrors);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  if (draft) {
    const pending = moves(draft);
    const patch = (i: number, p: Partial<DraftStage>) =>
      setDraft(draft.map((s, j) => (j === i ? { ...s, ...p } : s)));
    const swap = (i: number, j: number) => {
      const next = [...draft];
      [next[i], next[j]] = [next[j], next[i]];
      setDraft(next);
    };

    return (
      <div className="space-y-3">
        {draft.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sans étape, les dossiers n&apos;affichent pas leur avancement.
          </p>
        )}
        <ol className="space-y-2">
          {draft.map((s, i) => (
            <li key={s.key} className="flex max-w-xl items-start gap-1.5">
              <span
                aria-hidden
                className="mt-2 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor={`stage-edit-${s.key}`} className="sr-only">
                  Étape {i + 1}
                </Label>
                <Input
                  id={`stage-edit-${s.key}`}
                  value={s.name}
                  maxLength={60}
                  placeholder="Nom de l'étape"
                  autoFocus={s.id === null && i === draft.length - 1}
                  aria-invalid={Boolean(fieldErrors[`stages.${i}.name`])}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <FieldError message={fieldErrors[`stages.${i}.name`]} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Monter l'étape ${i + 1}`}
                disabled={i === 0}
                onClick={() => swap(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Descendre l'étape ${i + 1}`}
                disabled={i === draft.length - 1}
                onClick={() => swap(i, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Retirer l'étape ${i + 1}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>

        {draft.length < MAX_STAGES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft([...draft, { key: `new-${Date.now()}`, id: null, name: "" }])
            }
          >
            <Plus /> Ajouter une étape
          </Button>
        )}

        {pending.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {pending
              .map((m) => `${plural(m.cases, "dossier")} de « ${m.from} » passeront à « ${m.to} »`)
              .join(" ; ")}
            .
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            disabled={saving}
            onClick={() => (pending.length > 0 ? setConfirming(true) : save())}
          >
            {saving ? "Enregistrement…" : "Enregistrer les étapes"}
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
            Annuler
          </Button>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <ConfirmDialog
          open={confirming}
          title="Retirer des étapes qui ont des dossiers ?"
          body={`${pending
            .map((m) => `${plural(m.cases, "dossier")} de « ${m.from} » passeront à « ${m.to} »`)
            .join(" ; ")}. Aucun dossier n'est supprimé.`}
          confirmLabel="Enregistrer les étapes"
          loading={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={save}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune étape : les dossiers de cette campagne n&apos;affichent pas leur avancement.
        </p>
      ) : (
        <ol className="divide-y rounded-xl border" aria-label="Dossiers actifs par étape">
          {stages.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/cases?campagne=${campaignId}&etape=${s.id}`}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60"
              >
                <span
                  aria-hidden
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="w-36 shrink-0 truncate font-medium sm:w-60">{s.name}</span>
                <span aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(s.activeCases / maxActive) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums">
                  <span className="sr-only">Dossiers actifs : </span>
                  {s.activeCases}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={startEdit}>
          {stages.length === 0 ? (
            <>
              <Plus /> Définir les étapes
            </>
          ) : (
            <>
              <Pencil /> Modifier les étapes
            </>
          )}
        </Button>
      )}
    </div>
  );
}

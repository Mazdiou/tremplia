"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { plural } from "@/lib/plural";

type Action = "archive" | "unarchive" | "delete";

const DIALOGS: Record<Action, { title: string; body: string; confirm: string }> = {
  archive: {
    title: "Archiver cette campagne ?",
    body: "Elle disparaît de l'arbre (sauf réglage contraire), ne reçoit plus de dossier ni de groupe, et ses réglages sont figés. Ses dossiers restent consultables et modifiables. Vous pourrez la réactiver.",
    confirm: "Archiver",
  },
  unarchive: {
    title: "Réactiver cette campagne ?",
    body: "Elle reçoit de nouveau des dossiers et ses réglages redeviennent modifiables.",
    confirm: "Réactiver",
  },
  delete: {
    title: "Supprimer cette campagne ?",
    body: "Ses dates, informations et groupes sont supprimés définitivement. Une campagne qui contient des dossiers ne peut pas être supprimée : archivez-la.",
    confirm: "Supprimer définitivement",
  },
};

// Zone sensible de la page d'une campagne : patron seulement
export function CampaignDangerZone({
  campaignId,
  archived,
  caseCount,
}: {
  campaignId: string;
  archived: boolean;
  caseCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(action: Action) {
    setBusy(true);
    setError(null);
    const res = await callApi(
      action === "delete" ? `/api/campaigns/${campaignId}` : `/api/campaigns/${campaignId}/${action}`,
      { method: action === "delete" ? "DELETE" : "POST" },
    );
    setBusy(false);
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (action === "delete") router.push("/campaigns");
    router.refresh();
  }

  const dialog = pending ? DIALOGS[pending] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPending(archived ? "unarchive" : "archive")}>
          {archived ? "Réactiver la campagne" : "Archiver la campagne"}
        </Button>
        <Button variant="destructive" disabled={caseCount > 0} onClick={() => setPending("delete")}>
          Supprimer la campagne
        </Button>
      </div>
      {caseCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Cette campagne contient {plural(caseCount, "dossier")} :
          elle ne peut pas être supprimée, seulement archivée.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        body={dialog?.body ?? ""}
        confirmLabel={dialog?.confirm ?? ""}
        danger={pending === "delete"}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && confirm(pending)}
      />
    </div>
  );
}

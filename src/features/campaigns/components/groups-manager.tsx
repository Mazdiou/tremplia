"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callApi } from "@/lib/api-client";
import { MAX_CAMPAIGN_GROUPS } from "../schemas";

export type ManagedGroup = { id: string; name: string; activeCases: number };

// Message d'erreur, ou null en cas de succès
async function send(url: string, method: string, body?: unknown) {
  const res = await callApi(url, { method, body });
  return res.ok ? null : res.error;
}

// Groupes d'une campagne : tout membre actif les gère, sauf si la campagne
// est archivée (ils sont alors figés).
export function GroupsManager({
  campaignId,
  groups,
  readOnly,
}: {
  campaignId: string;
  groups: ManagedGroup[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<ManagedGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string | null>) {
    setError(null);
    setBusy(true);
    const failure = await action();
    setBusy(false);
    if (failure) {
      setError(failure);
      return false;
    }
    router.refresh();
    return true;
  }

  const base = `/api/campaigns/${campaignId}/groups`;

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun groupe : tous les dossiers sont « Non classés ».
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {groups.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {editing === g.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(() => send(`${base}/${g.id}`, "PATCH", { name: editName }))) {
                      setEditing(null);
                    }
                  }}
                >
                  <Label htmlFor={`rename-${g.id}`} className="sr-only">
                    Nouveau nom du groupe
                  </Label>
                  <Input
                    id={`rename-${g.id}`}
                    value={editName}
                    maxLength={80}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                  />
                  <Button type="submit" size="icon-sm" variant="ghost" aria-label="Enregistrer" disabled={busy}>
                    <Check />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Annuler" onClick={() => setEditing(null)}>
                    <X />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.activeCases} dossier{g.activeCases > 1 ? "s" : ""} actif{g.activeCases > 1 ? "s" : ""}
                  </span>
                  {!readOnly && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Renommer ${g.name}`}
                        onClick={() => {
                          setEditing(g.id);
                          setEditName(g.name);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Supprimer ${g.name}`}
                        onClick={() => setToDelete(g)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && groups.length < MAX_CAMPAIGN_GROUPS && (
        <form
          className="flex max-w-sm items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => send(base, "POST", { name: newName }))) setNewName("");
          }}
        >
          <Label htmlFor="group-new" className="sr-only">
            Nom du nouveau groupe
          </Label>
          <Input
            id="group-new"
            placeholder="Nouveau groupe"
            value={newName}
            maxLength={80}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy || !newName.trim()}>
            <Plus /> Ajouter
          </Button>
        </form>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Supprimer le groupe « ${toDelete?.name ?? ""} » ?`}
        body="Les dossiers de ce groupe ne sont pas supprimés : ils perdent seulement ce classement (et passent dans « Non classés » s'ils n'ont plus aucun groupe)."
        confirmLabel="Supprimer le groupe"
        danger
        loading={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await run(() => send(`${base}/${toDelete.id}`, "DELETE")))) {
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}

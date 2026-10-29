"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { PERMISSIONS, PERMISSION_INFO, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Permissions d'un employé de confiance : résumé sous son nom, et cases à
// cocher pour le patron. Ce que tout employé peut déjà faire n'est pas listé.
export function EmployeePermissions({
  id,
  name,
  permissions,
  canEdit,
}: {
  id: string;
  name: string;
  permissions: Permission[];
  // Faux en lecture seule (abonnement expiré)
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<Permission>>(new Set(permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setChecked(new Set(permissions));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await callApi(`/api/team/employees/${id}/permissions`, {
      method: "PUT",
      body: { permissions: PERMISSIONS.filter((p) => checked.has(p)) },
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <KeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {permissions.length === 0 ? (
          <span className="text-muted-foreground">Aucune permission en plus</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label={`Permissions de ${name}`}>
            {permissions.map((p) => (
              <li
                key={p}
                className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground"
              >
                {PERMISSION_INFO[p].label}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="xs"
            onClick={open}
            aria-label={`Modifier les permissions de ${name}`}
          >
            Modifier
          </Button>
        )}
      </div>
    );
  }

  return (
    <fieldset
      className="space-y-3 rounded-xl border bg-muted/30 p-3"
      onKeyDown={(e) => e.key === "Escape" && !saving && setEditing(false)}
    >
      <legend className="sr-only">Permissions de {name}</legend>
      <p className="text-xs text-muted-foreground">
        En plus des dossiers, documents et paiements, accessibles à tous.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {PERMISSIONS.map((p) => {
          const on = checked.has(p);
          return (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 text-sm transition-colors",
                on && "border-primary",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={saving}
                onChange={() =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (next.has(p)) next.delete(p);
                    else next.add(p);
                    return next;
                  })
                }
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block font-medium">{PERMISSION_INFO[p].label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {PERMISSION_INFO[p].description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>
          Annuler
        </Button>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </div>
    </fieldset>
  );
}

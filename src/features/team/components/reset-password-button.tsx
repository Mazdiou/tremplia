"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { CopyButton } from "./copy-button";

// Nouveau mot de passe temporaire pour un employé qui a oublié le sien.
// Affiché une seule fois sous la ligne, comme à la création du compte.
export function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  async function reset() {
    setLoading(true);
    const res = await callApi<{ temporaryPassword: string }>(
      `/api/team/employees/${id}/password`,
    );
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setConfirming(false);
    setPassword(res.data.temporaryPassword);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setPassword(null);
          setConfirming(true);
        }}
      >
        Nouveau mot de passe
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Nouveau mot de passe pour ${name} ?`}
        body={
          error ??
          "Son mot de passe actuel ne marchera plus. Elle en choisira un nouveau à sa prochaine connexion."
        }
        confirmLabel="Créer le mot de passe"
        loading={loading}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void reset()}
      />
      {password && (
        <div
          role="status"
          className="flex basis-full flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-highlight px-4 py-3 text-left text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">Mot de passe temporaire de {name}</p>
            <p className="text-muted-foreground">
              Notez-le maintenant : il ne sera plus affiché.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border bg-card px-3 py-2 font-mono text-[0.8125rem]">
              {password}
            </code>
            <CopyButton value={password} />
            <Button variant="ghost" size="sm" onClick={() => setPassword(null)}>
              Masquer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

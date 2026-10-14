"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

export function ToggleActiveButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setLoading(true);
    const res = await callApi(`/api/team/employees/${id}/status`, {
      method: "PATCH",
      body: { isActive: !isActive },
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      // Réactivation (sans boîte) : l'erreur s'affiche sous le bouton
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => {
          setError(null);
          // Désactiver demande confirmation ; réactiver est immédiat
          if (isActive) setConfirming(true);
          else void toggle();
        }}
      >
        {isActive ? "Désactiver" : "Réactiver"}
      </Button>
      {error && !confirming && (
        <p className="basis-full text-right text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title="Désactiver ce compte ?"
        body={error ?? "La personne ne pourra plus se connecter. Vous pourrez la réactiver."}
        confirmLabel="Désactiver"
        danger
        loading={loading}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void toggle()}
      />
    </>
  );
}

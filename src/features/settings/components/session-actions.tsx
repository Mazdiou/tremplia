"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// Déconnexion de cet appareil, ou de tous (téléphone perdu, ordinateur
// partagé). Sur téléphone, c'est ici que se trouve « Se déconnecter ».
export function SessionActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(scope: "local" | "global") {
    setError(null);
    setLoading(true);
    const { error: signOutError } = await createClient().auth.signOut({ scope });
    // Hors ligne, la session de cet appareil est quand même effacée ; les
    // autres appareils, eux, n'ont pas pu être déconnectés
    if (signOutError && scope === "global") {
      setLoading(false);
      setConfirming(false);
      setError("Déconnexion des autres appareils impossible. Vérifiez votre réseau et réessayez.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={loading} onClick={() => void signOut("local")}>
          <LogOut /> Se déconnecter
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <MonitorSmartphone /> Se déconnecter de tous les appareils
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title="Se déconnecter de tous les appareils ?"
        body="Vos sessions sont fermées partout, celle-ci comprise : il faudra vous reconnecter sur chaque appareil."
        confirmLabel="Tout déconnecter"
        danger
        loading={loading}
        onConfirm={() => void signOut("global")}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

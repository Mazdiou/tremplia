"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

// Réglages (patron) : réafficher ou masquer le guide « Bien démarrer »
export function GuideSetting({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await callApi("/api/onboarding/guide", {
      method: "PUT",
      body: { hidden: !hidden },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="outline" onClick={() => void toggle()} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {hidden ? "Afficher le guide" : "Masquer le guide"}
        </Button>
        {!hidden && (
          <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
            Voir sur le tableau de bord
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

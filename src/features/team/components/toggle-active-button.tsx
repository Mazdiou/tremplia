"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (
      isActive &&
      !confirm(
        "Désactiver ce compte ? La personne ne pourra plus se connecter.",
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/team/employees/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setLoading(false);
    if (!res.ok)
      alert(
        (await res.json().catch(() => null))?.error ?? `Erreur ${res.status}`,
      );
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={loading}>
      {isActive ? "Désactiver" : "Réactiver"}
    </Button>
  );
}

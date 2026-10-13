"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteEmployeeButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (
      !confirm(
        `Supprimer définitivement le compte de ${name} ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/team/employees/${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok)
      alert(
        (await res.json().catch(() => null))?.error ?? `Erreur ${res.status}`,
      );
    router.refresh();
  }

  return (
    <Button variant="destructive" size="sm" onClick={remove} disabled={loading}>
      Supprimer
    </Button>
  );
}

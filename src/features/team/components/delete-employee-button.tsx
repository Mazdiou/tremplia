"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

export function DeleteEmployeeButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    const res = await callApi(`/api/team/employees/${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Supprimer
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Supprimer le compte de ${name} ?`}
        body={error ?? "Le compte est supprimé définitivement. Cette action est irréversible."}
        confirmLabel="Supprimer définitivement"
        danger
        loading={loading}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

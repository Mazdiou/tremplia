"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { sameAgencyName } from "../schemas";

// Suppression définitive d'une agence : le bouton ne s'active qu'une fois le
// nom de l'agence retapé (le serveur le vérifie aussi)
export function DeleteAgencyButton({
  agency,
}: {
  agency: { id: string; name: string; cases: number; members: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    const res = await callApi(`/api/admin/agencies/${agency.id}`, {
      method: "DELETE",
      body: { confirmName: typed },
    });
    if (!res.ok) {
      setLoading(false);
      return setError(res.error);
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 />
        Supprimer l&apos;agence
      </Button>
      <ConfirmDialog
        open={open}
        title={`Supprimer « ${agency.name} » ?`}
        body={`Tout sera supprimé définitivement : ${plural(agency.cases, "dossier")}, leurs documents, paiements et messages, les campagnes, l'historique et les comptes de ${plural(agency.members, "membre actif", "membres actifs")} (et des anciens membres). Les candidats perdent l'accès à leur espace. Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        danger
        loading={loading}
        confirmDisabled={!sameAgencyName(typed, agency.name)}
        onCancel={() => setOpen(false)}
        onConfirm={() => void remove()}
      >
        <TextField
          id={`delete-agency-${agency.id}`}
          label={`Pour confirmer, tapez le nom de l'agence : ${agency.name}`}
          value={typed}
          onChange={setTyped}
          maxLength={200}
          autoComplete="off"
          error={error ?? undefined}
        />
      </ConfirmDialog>
    </>
  );
}

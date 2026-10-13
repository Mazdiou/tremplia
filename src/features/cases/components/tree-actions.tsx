"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return res.ok ? null : (data?.error ?? `Erreur ${res.status}`);
}

// Saisie d'un nom de groupe sur une ligne de l'arbre (Entrée : valider,
// Échap : annuler). Renvoie un message d'erreur, ou null en cas de succès.
export function InlineNameInput({
  label,
  initial = "",
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: string;
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const failure = await onSubmit(name);
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <form onSubmit={submit} className="mx-3 my-1 space-y-1 pl-5">
      <div className="flex items-center gap-1">
        <input
          aria-label={label}
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          className="h-7 min-w-0 flex-1 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon-xs" variant="ghost" aria-label="Valider" disabled={busy}>
          <Check />
        </Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="Annuler" onClick={onCancel}>
          <X />
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

// Menu « … » d'une campagne dans l'arbre
export function CampaignMenu({
  campaignId,
  campaignName,
  active,
  onAddGroup,
}: {
  campaignId: string;
  campaignName: string;
  active: boolean;
  onAddGroup: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermeture au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Actions sur ${campaignName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute top-7 right-0 z-30 w-48 rounded-xl border bg-popover p-1 shadow-lg"
        >
          {active && (
            <Link role="menuitem" href={`/cases/new?campaign=${campaignId}`} className={item}>
              Nouveau dossier
            </Link>
          )}
          {active && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                onAddGroup();
              }}
            >
              Ajouter un groupe
            </button>
          )}
          <Link role="menuitem" href={`/campaigns/${campaignId}`} className={item}>
            Ouvrir la campagne
          </Link>
        </div>
      )}
    </div>
  );
}

// Boutons Renommer / Supprimer d'un groupe, visibles au survol ou au focus
export function GroupActions({
  campaignId,
  groupId,
  groupName,
  onRename,
  className,
}: {
  campaignId: string;
  groupId: string;
  groupName: string;
  onRename: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className={cn("flex items-center", className)}>
      <Button variant="ghost" size="icon-xs" aria-label={`Renommer ${groupName}`} onClick={onRename}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Supprimer ${groupName}`}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Supprimer le groupe « ${groupName} » ?`}
        body={
          error ??
          "Les dossiers de ce groupe ne sont pas supprimés : ils perdent seulement ce classement."
        }
        confirmLabel="Supprimer le groupe"
        danger
        loading={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setBusy(true);
          const failure = await send(`/api/campaigns/${campaignId}/groups/${groupId}`, "DELETE");
          setBusy(false);
          if (failure) {
            setError(failure);
            return;
          }
          setConfirming(false);
          router.refresh();
        }}
      />
    </span>
  );
}

export const groupApi = {
  create: (campaignId: string, name: string) =>
    send(`/api/campaigns/${campaignId}/groups`, "POST", { name }),
  rename: (campaignId: string, groupId: string, name: string) =>
    send(`/api/campaigns/${campaignId}/groups/${groupId}`, "PATCH", { name }),
};

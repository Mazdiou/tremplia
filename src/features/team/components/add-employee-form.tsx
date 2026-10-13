"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // copie impossible : le mot de passe reste affiché
        }
      }}
    >
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

export function AddEmployeeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email"));

    setLoading(true);
    const res = await fetch("/api/team/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email,
      }),
    });
    setLoading(false);

    const data = await res.json().catch(() => null);
    if (!res.ok)
      return setError(data?.error ?? `Erreur serveur (${res.status})`);

    setCreated({ email, password: data.temporaryPassword });
    formEl.reset();
    router.refresh();
  }

  return (
    <div className="space-y-4 p-[18px]">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="firstName">Prénom</Label>
          <Input id="firstName" name="firstName" placeholder="Prénom" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lastName">Nom</Label>
          <Input id="lastName" name="lastName" placeholder="Nom" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" placeholder="e-mail@exemple.com" required />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Création..." : "Créer le compte"}
          </Button>
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {created && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-highlight px-4 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">Compte créé pour {created.email}</p>
            <p className="text-muted-foreground">
              Notez ce mot de passe maintenant : il ne sera plus affiché.
              L&apos;employé en choisira un nouveau à sa première connexion.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border bg-card px-3 py-2 font-mono text-[13px]">
              {created.password}
            </code>
            <CopyButton value={created.password} />
          </div>
        </div>
      )}
    </div>
  );
}

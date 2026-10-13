"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HIDE_AFTER_MS = 30_000;

export function PastelPinned({
  caseId,
  account,
  email,
}: {
  caseId: string;
  account: "to_create" | "existing";
  email: string | null;
}) {
  const router = useRouter();
  const isExisting = account === "existing";

  const [password, setPassword] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Masquage automatique après 30 s, décompte affiché, et masquage immédiat
  // si l'onglet du navigateur passe en arrière-plan.
  useEffect(() => {
    if (password === null) return;
    const hide = setTimeout(() => setPassword(null), HIDE_AFTER_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisibility = () => {
      if (document.hidden) setPassword(null);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(hide);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [password]);

  useEffect(() => {
    if (copied === null) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  async function reveal() {
    setError(null);
    setRevealing(true);
    const res = await fetch(`/api/cases/${caseId}/pastel/reveal`, {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    setRevealing(false);
    if (!res.ok || typeof data?.password !== "string") {
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }
    const t = Date.now();
    setExpiresAt(t + HIDE_AFTER_MS);
    setNow(t);
    setCopied(null);
    setPassword(data.password);
  }

  async function copy(value: string, what: "email" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setError("Copie impossible : copiez la valeur à la main.");
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);

    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/pastel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pastelEmail: String(form.get("pastelEmail") ?? ""),
        pastelPassword: String(form.get("pastelPassword") ?? ""),
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      if (Array.isArray(data?.fields)) {
        const map: Record<string, string> = {};
        for (const f of data.fields as { path: string; message: string }[]) {
          if (!map[f.path]) map[f.path] = f.message;
        }
        setFieldErrors(map);
      }
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }

    setEditing(false);
    setPassword(null);
    router.refresh();
  }

  function startEditing() {
    setEditing(true);
    setPassword(null);
    setError(null);
  }

  return (
    <div className="mt-3 rounded-xl border bg-muted/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <KeyRound className="size-4" aria-hidden />
          Pastel
        </span>

        {isExisting ? (
          <>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium">{email ?? "—"}</span>
              {email && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => copy(email, "email")}
                  aria-label="Copier l'e-mail Pastel"
                  title="Copier l'e-mail"
                >
                  {copied === "email" ? <Check /> : <Copy />}
                </Button>
              )}
            </span>

            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />

            {password === null ? (
              <span className="flex items-center gap-2">
                <span aria-hidden className="tracking-widest">
                  ••••••••
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={reveal}
                  disabled={revealing}
                >
                  <Eye /> {revealing ? "Chargement..." : "Afficher"}
                </Button>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-background px-2 py-0.5 break-all">
                  {password}
                </code>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => copy(password, "password")}
                >
                  {copied === "password" ? <Check /> : <Copy />}
                  {copied === "password" ? "Copié" : "Copier"}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setPassword(null)}
                >
                  <EyeOff /> Masquer
                </Button>
                <span
                  className="text-xs text-muted-foreground tabular-nums"
                  aria-live="off"
                >
                  {secondsLeft} s
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Compte Pastel à créer</span>
        )}

        {!editing && (
          <Button
            variant={isExisting ? "ghost" : "outline"}
            size="xs"
            onClick={startEditing}
            className="ml-auto"
          >
            {isExisting ? (
              <>
                <Pencil /> Modifier
              </>
            ) : (
              "Renseigner le compte"
            )}
          </Button>
        )}
      </div>

      {isExisting && password !== null && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Cet affichage est enregistré dans le journal de l&apos;agence.
        </p>
      )}

      {editing && (
        <form
          onSubmit={save}
          className="grid gap-4 border-t px-3 py-3 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="pastelEmail">E-mail du compte Pastel</Label>
            <Input
              id="pastelEmail"
              name="pastelEmail"
              type="email"
              autoComplete="off"
              defaultValue={email ?? ""}
              required
            />
            {fieldErrors.pastelEmail && (
              <p className="text-sm text-red-600">{fieldErrors.pastelEmail}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pastelPassword">
              Mot de passe du compte Pastel
            </Label>
            <Input
              id="pastelPassword"
              name="pastelPassword"
              type="password"
              autoComplete="new-password"
              required={!isExisting}
            />
            {fieldErrors.pastelPassword && (
              <p className="text-sm text-red-600">
                {fieldErrors.pastelPassword}
              </p>
            )}
            {isExisting && (
              <p className="text-xs text-muted-foreground">
                Laissez vide pour garder le mot de passe actuel.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Le mot de passe est chiffré avant d&apos;être enregistré et
            n&apos;apparaît jamais dans les listes ni dans le journal.
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setError(null);
                setFieldErrors({});
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="border-t px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

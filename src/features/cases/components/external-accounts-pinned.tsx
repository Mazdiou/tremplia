"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil, Plus } from "lucide-react";
import { FieldError } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXTERNAL_ACCOUNT_STATUS_LABELS,
  MAX_EXTERNAL_ACCOUNTS,
  type ExternalAccountStatus,
} from "@/features/cases/labels";
import { callApi } from "@/lib/api-client";
import { TRACK_INDENT, TrackRow } from "./case-header";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

type PinnedAccount = {
  id: string;
  platform: string;
  url: string | null;
  login: string | null;
  status: ExternalAccountStatus;
};

const HIDE_AFTER_MS = 30_000;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// En-tête de la fiche : comptes du candidat sur les plateformes externes.
// Le mot de passe n'est jamais dans la page : il est demandé au serveur, qui
// inscrit l'affichage au journal avant de le renvoyer.
export function ExternalAccountsPinned({
  caseId,
  accounts,
  suggestions,
  readOnly = false,
}: {
  caseId: string;
  accounts: PinnedAccount[];
  suggestions: string[];
  // Abonnement expiré : consultation seulement
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const listId = useId();
  const used = new Set(accounts.map((a) => a.platform.toLocaleLowerCase("fr")));
  const free = suggestions.filter((s) => !used.has(s.toLocaleLowerCase("fr")));

  const canAdd = !readOnly && !adding && accounts.length < MAX_EXTERNAL_ACCOUNTS;

  // Section du panneau de suivi : une ligne d'en-tête, puis un compte par
  // ligne, alignés sous le contenu de l'en-tête
  return (
    <div className="divide-y">
      <datalist id={listId}>
        {free.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <TrackRow
        icon={KeyRound}
        label="Comptes externes"
        summary={accounts.length > 0}
        actions={
          canAdd && (
            <Button variant="ghost" size="xs" onClick={() => setAdding(true)}>
              <Plus /> Ajouter
            </Button>
          )
        }
      >
        {accounts.length === 0 ? (
          <span className="text-muted-foreground">{adding ? "Nouveau compte" : "Aucun"}</span>
        ) : (
          <span className="text-muted-foreground tabular-nums">
            {plural(accounts.length, "compte")}
          </span>
        )}
      </TrackRow>

      {accounts.length > 0 && (
        <ul className="divide-y">
          {accounts.map((a) => (
            <AccountRow key={a.id} caseId={caseId} account={a} listId={listId} readOnly={readOnly} />
          ))}
        </ul>
      )}

      {adding && (
        <AccountForm
          caseId={caseId}
          listId={listId}
          onDone={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function AccountRow({
  caseId,
  account,
  listId,
  readOnly,
}: {
  caseId: string;
  account: PinnedAccount;
  listId: string;
  readOnly: boolean;
}) {
  const [password, setPassword] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function reveal() {
    setError(null);
    setRevealing(true);
    const res = await callApi<{ password?: unknown }>(
      `/api/cases/${caseId}/external-accounts/${account.id}/reveal`,
    );
    setRevealing(false);
    if (!res.ok || typeof res.data.password !== "string") {
      setError(res.ok ? "Impossible de lire le mot de passe" : res.error);
      return;
    }
    const t = Date.now();
    setExpiresAt(t + HIDE_AFTER_MS);
    setNow(t);
    setPassword(res.data.password);
  }

  async function copy(value: string, what: "login" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setError("Copie impossible : copiez la valeur à la main.");
    }
  }

  const isExisting = account.status === "existing";
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  if (editing) {
    return (
      <li>
        <AccountForm
          caseId={caseId}
          listId={listId}
          account={account}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2", TRACK_INDENT)}>
        <span className="flex items-center gap-1.5 font-medium">
          {account.url ? (
            <a
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {account.platform}
            </a>
          ) : (
            account.platform
          )}
        </span>

        {account.login && (
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{account.login}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => copy(account.login!, "login")}
              aria-label={`Copier l'identifiant ${account.platform}`}
              title="Copier l'identifiant"
            >
              {copied === "login" ? <Check /> : <Copy />}
            </Button>
          </span>
        )}

        {isExisting ? (
          password === null ? (
            <Button variant="outline" size="xs" onClick={reveal} disabled={revealing}>
              <Eye /> {revealing ? "Chargement…" : "Afficher le mot de passe"}
            </Button>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-background px-2 py-0.5 break-all">
                {password}
              </code>
              <Button variant="outline" size="xs" onClick={() => copy(password, "password")}>
                {copied === "password" ? <Check /> : <Copy />}
                {copied === "password" ? "Copié" : "Copier"}
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setPassword(null)}>
                <EyeOff /> Masquer
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {secondsLeft} s
              </span>
            </span>
          )
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {EXTERNAL_ACCOUNT_STATUS_LABELS.to_create}
          </span>
        )}

        {!readOnly && (
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={() => {
              setPassword(null);
              setError(null);
              setEditing(true);
            }}
            aria-label={`Modifier le compte ${account.platform}`}
          >
            <Pencil /> Modifier
          </Button>
        )}
      </div>

      {password !== null && (
        <p className={cn("pb-2 text-xs text-muted-foreground", TRACK_INDENT)}>
          Cet affichage est enregistré dans le journal de l&apos;agence.
        </p>
      )}
      {error && (
        <p className={cn("pb-2 text-sm text-destructive", TRACK_INDENT)} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// Ajout (sans `account`) ou modification d'un compte
function AccountForm({
  caseId,
  listId,
  account,
  onDone,
}: {
  caseId: string;
  listId: string;
  account?: PinnedAccount;
  onDone: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const [status, setStatus] = useState<ExternalAccountStatus>(
    account?.status ?? "existing",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Compte déjà existant : il ne redevient pas « à créer », et son mot de
  // passe enregistré est gardé si le champ reste vide
  const wasExisting = account?.status === "existing";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const body = {
      platform: String(form.get("platform") ?? ""),
      url: String(form.get("url") ?? ""),
      login: String(form.get("login") ?? ""),
      status,
      password: status === "existing" ? String(form.get("password") ?? "") : "",
    };

    setSaving(true);
    const res = account
      ? await callApi(`/api/cases/${caseId}/external-accounts/${account.id}`, {
          method: "PUT",
          body,
        })
      : await callApi(`/api/cases/${caseId}/external-accounts`, { body });
    setSaving(false);

    if (!res.ok) {
      setFieldErrors(res.fieldErrors);
      setError(res.error);
      return;
    }
    onDone();
    router.refresh();
  }

  const id = (name: string) => `${formId}-${name}`;

  return (
    <form onSubmit={submit} className={cn("grid gap-3 py-3 sm:grid-cols-2", TRACK_INDENT)}>
      <div className="space-y-1">
        <Label htmlFor={id("platform")}>Plateforme</Label>
        <Input
          id={id("platform")}
          name="platform"
          list={listId}
          defaultValue={account?.platform}
          required
          maxLength={80}
        />
        <FieldError message={fieldErrors.platform} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("url")}>Adresse du site (facultatif)</Label>
        <Input
          id={id("url")}
          name="url"
          type="url"
          placeholder="https://"
          defaultValue={account?.url ?? ""}
        />
        <FieldError message={fieldErrors.url} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("status")}>Compte</Label>
        <select
          id={id("status")}
          value={status}
          disabled={wasExisting}
          onChange={(e) => setStatus(e.target.value as ExternalAccountStatus)}
          className={cn(selectClass, wasExisting && "opacity-60")}
        >
          <option value="existing">{EXTERNAL_ACCOUNT_STATUS_LABELS.existing}</option>
          <option value="to_create">{EXTERNAL_ACCOUNT_STATUS_LABELS.to_create}</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("login")}>
          Identifiant{status === "existing" ? "" : " (facultatif)"}
        </Label>
        <Input
          id={id("login")}
          name="login"
          autoComplete="off"
          defaultValue={account?.login ?? ""}
          required={status === "existing"}
        />
        <FieldError message={fieldErrors.login} />
      </div>
      {status === "existing" && (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={id("password")}>Mot de passe</Label>
          <Input
            id={id("password")}
            name="password"
            type="password"
            autoComplete="new-password"
            required={!wasExisting}
          />
          <FieldError message={fieldErrors.password} />
          <p className="text-xs text-muted-foreground">
            {wasExisting
              ? "Laissez vide pour garder le mot de passe actuel. "
              : ""}
            Il est chiffré avant d&apos;être enregistré et n&apos;apparaît jamais
            dans les listes ni dans le journal.
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

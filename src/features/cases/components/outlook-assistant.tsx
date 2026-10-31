"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { BRAND } from "@/config/brand";
import { FieldError } from "@/components/form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { callApi } from "@/lib/api-client";
import { formatLongDate } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import {
  OUTLOOK_DOMAINS,
  OUTLOOK_PLATFORM,
  OUTLOOK_SIGNUP_URL,
  OUTLOOK_URL,
  generateAccountPassword,
  isValidOutlookLocalPart,
  outlookAddressSuggestions,
  type OutlookDomain,
} from "../outlook";

export type AssistantCandidate = {
  firstName: string;
  lastName: string;
  // AAAA-MM-JJ
  birthDate: string;
  phone: string;
};

const selectClass =
  "h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Fenêtre « Adresse Outlook » : adresse proposée, mot de passe prêt, valeurs
// à recopier chez Microsoft, puis enregistrement du compte dans le dossier.
// Montée au premier clic seulement (le mot de passe est tiré dans le
// navigateur) et gardée ensuite : refermée par erreur, elle se rouvre avec
// les mêmes valeurs. `account` : ligne « Outlook à créer » à compléter.
export function OutlookAssistant({
  open,
  caseId,
  candidate,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  caseId: string;
  candidate: AssistantCandidate;
  account: { id: string; platform: string; url: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const ref = useModalDialog(open);
  const formId = useId();
  const id = (name: string) => `${formId}-${name}`;

  const suggestions = outlookAddressSuggestions(
    candidate.firstName,
    candidate.lastName,
    candidate.birthDate,
  );
  const [local, setLocal] = useState(suggestions[0] ?? "");
  const [domain, setDomain] = useState<OutlookDomain>(OUTLOOK_DOMAINS[0]);
  const [password, setPassword] = useState(() => generateAccountPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const address = `${local.trim()}@${domain}`;
  const localError =
    local.trim() === ""
      ? "Choisissez une adresse"
      : isValidOutlookLocalPart(local.trim())
        ? null
        : "Lettres, chiffres, « . », « _ » et « - » seulement, en commençant par une lettre";
  const passwordError = password.length < 8 ? "8 caractères au moins" : null;
  const ready = !localError && !passwordError;

  async function save() {
    if (!ready) return;
    setError(null);
    setFieldErrors({});
    const body = {
      platform: account?.platform ?? OUTLOOK_PLATFORM,
      url: account?.url ?? OUTLOOK_URL,
      login: address,
      status: "existing",
      password,
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
    onSaved();
    router.refresh();
  }

  const fields = [
    { label: "Adresse e-mail", value: address, copy: true },
    { label: "Mot de passe", value: password, copy: true },
    { label: "Date de naissance", value: formatLongDate(candidate.birthDate), copy: false },
    { label: "Prénom", value: candidate.firstName, copy: true },
    { label: "Nom", value: candidate.lastName, copy: true },
    ...(candidate.phone
      ? [{ label: "Téléphone", value: candidate.phone, copy: true }]
      : []),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={id("title")}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <div>
          <h2 id={id("title")} className="text-base font-semibold">
            Créer une adresse Outlook
            <span className="block text-sm font-normal text-muted-foreground">
              {displayName(candidate.firstName, candidate.lastName)}
            </span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Microsoft ne permet pas de créer le compte depuis {BRAND.name}. Tout est
            prêt ici : il reste à le recopier sur son site.
          </p>
        </div>

        <Step n={1} title="Choisissez l'adresse">
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Adresses proposées">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={local === s}
                  onClick={() => setLocal(s)}
                  className={cn(
                    "touch-target rounded-full border px-2.5 py-1 text-xs break-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    local === s
                      ? "border-primary bg-primary/10 font-medium text-link"
                      : "hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={id("local")}>Adresse</Label>
            <div className="flex gap-2">
              <Input
                id={id("local")}
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
                aria-invalid={localError ? true : undefined}
                aria-describedby={id("local-hint")}
                className="min-w-0 flex-1"
              />
              <select
                aria-label="Domaine"
                value={domain}
                onChange={(e) => setDomain(e.target.value as OutlookDomain)}
                className={selectClass}
              >
                {OUTLOOK_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    @{d}
                  </option>
                ))}
              </select>
            </div>
            <FieldError message={localError ?? fieldErrors.login} />
            <p id={id("local-hint")} className="text-xs text-muted-foreground">
              Déjà prise chez Microsoft ? Essayez la suivante, ou corrigez-la ici.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("password")}>Mot de passe</Label>
            <div className="flex gap-2">
              <Input
                id={id("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={200}
                aria-invalid={passwordError ? true : undefined}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPassword(generateAccountPassword())}
                aria-label="Proposer un autre mot de passe"
                title="Un autre"
              >
                <RefreshCw />
              </Button>
            </div>
            <FieldError message={passwordError ?? fieldErrors.password} />
          </div>
        </Step>

        <Step n={2} title="Créez le compte chez Microsoft">
          <a
            href={OUTLOOK_SIGNUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            <ExternalLink /> Ouvrir l&apos;inscription Microsoft
          </a>
          <dl className="divide-y rounded-xl border text-sm">
            {fields.map((f) => (
              // Téléphone : libellé au-dessus de la valeur, qui garde
              // toute la largeur
              <div
                key={f.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
              >
                <dt className="text-xs text-muted-foreground sm:text-sm">{f.label}</dt>
                <dd className="col-start-1 font-medium [overflow-wrap:anywhere] sm:col-start-2 sm:row-start-1">
                  {f.value}
                </dd>
                {f.copy && (
                  <span className="col-start-2 row-span-2 row-start-1 sm:col-start-3 sm:row-span-1">
                    <CopyButton value={f.value} label={f.label} />
                  </span>
                )}
              </div>
            ))}
          </dl>
          {candidate.phone && (
            <p className="text-xs text-muted-foreground">
              Si Microsoft demande un numéro, donnez celui du candidat : c&apos;est lui qui
              pourra récupérer le compte plus tard.
            </p>
          )}
        </Step>

        <Step n={3} title="Enregistrez le compte">
          <p className="text-sm text-muted-foreground">
            Microsoft vous a fait changer l&apos;adresse ou le mot de passe ? Corrigez-les
            plus haut avant d&apos;enregistrer. Le mot de passe est chiffré.
          </p>
        </Step>

        {error && Object.keys(fieldErrors).length === 0 && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Fermer
          </Button>
          <Button type="submit" disabled={saving || !ready}>
            {saving ? "Enregistrement…" : "Compte créé : enregistrer"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-link"
        >
          {n}
        </span>
        <span>
          <span className="sr-only">Étape {n} : </span>
          {title}
        </span>
      </h3>
      {children}
    </section>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      aria-label={failed ? `${label} : copie impossible, copiez à la main` : `Copier : ${label}`}
      title={failed ? "Copie impossible : copiez à la main" : "Copier"}
      className="shrink-0"
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

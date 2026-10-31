"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import { FieldError } from "@/components/form-fields";
import { MENU_ITEM_CLASS } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXTERNAL_ACCOUNT_STATUS_LABELS,
  MAX_EXTERNAL_ACCOUNTS,
  type ExternalAccountStatus,
} from "@/features/cases/labels";
import { useDismiss } from "@/hooks/use-dismiss";
import { callApi } from "@/lib/api-client";
import { RowMenu, TrackRow } from "./case-header";
import { OutlookAssistant, type AssistantCandidate } from "./outlook-assistant";
import { AccountsHandover } from "./accounts-handover";
import { isOutlookPlatform } from "../outlook";
import { cn } from "@/lib/utils";

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

// En-tête de la fiche : comptes du candidat sur les plateformes externes, un
// par pastille (la ligne garde sa hauteur quel que soit leur nombre). La
// pastille ouvre la fiche du compte : identifiant, mot de passe, site.
// Le mot de passe n'est jamais dans la page : il est demandé au serveur, qui
// inscrit l'affichage au journal avant de le renvoyer. L'assistant Outlook
// prépare l'adresse du candidat ; « Remettre » lui transmet ses comptes.
export function ExternalAccountsPinned({
  caseId,
  accounts,
  suggestions,
  candidate,
  agencyName,
  readOnly = false,
}: {
  caseId: string;
  accounts: PinnedAccount[];
  suggestions: string[];
  candidate: AssistantCandidate;
  agencyName: string;
  // Abonnement expiré : consultation seulement
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  // Compte en cours de modification (formulaire sous les pastilles)
  const [editing, setEditing] = useState<string | null>(null);
  // Une seule fiche de compte ouverte à la fois
  const [openId, setOpenId] = useState<string | null>(null);
  // Assistant monté au premier clic puis gardé (valeurs conservées)
  const [assistant, setAssistant] = useState<"open" | "closed" | null>(null);
  const [handover, setHandover] = useState(false);
  const listId = useId();
  const used = new Set(accounts.map((a) => a.platform.toLocaleLowerCase("fr")));
  const free = suggestions.filter((s) => !used.has(s.toLocaleLowerCase("fr")));
  const editedAccount = accounts.find((a) => a.id === editing) ?? null;

  const canAdd =
    !readOnly && !adding && !editedAccount && accounts.length < MAX_EXTERNAL_ACCOUNTS;
  // Compte Outlook prévu (« à créer ») : l'assistant le complète au lieu
  // d'en ajouter un
  const outlookToCreate =
    accounts.find((a) => a.status === "to_create" && isOutlookPlatform(a.platform)) ?? null;
  const hasOutlook = accounts.some(
    (a) => a.status === "existing" && isOutlookPlatform(a.platform),
  );
  const assistInMenu = canAdd && !hasOutlook && outlookToCreate === null;
  const canHandOver = accounts.some((a) => a.status === "existing");

  const openAssistant = () => {
    setAdding(false);
    setEditing(null);
    setOpenId(null);
    setAssistant("open");
  };
  const startAdding = () => {
    setEditing(null);
    setOpenId(null);
    setAdding(true);
  };

  return (
    <>
      <datalist id={listId}>
        {free.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <TrackRow
        icon={KeyRound}
        label="Comptes"
        multiline
        actions={
          (canAdd || canHandOver) && (
            <>
              {assistInMenu ? (
                <RowMenu
                  label="Ajouter un compte"
                  size="xs"
                  trigger={
                    <>
                      <Plus /> Ajouter <ChevronDown />
                    </>
                  }
                >
                  {(close) => (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
                        onClick={() => {
                          close();
                          openAssistant();
                        }}
                      >
                        <Mail className="size-4 text-muted-foreground" aria-hidden />
                        Adresse Outlook (assistant)
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
                        onClick={() => {
                          close();
                          startAdding();
                        }}
                      >
                        <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                        Autre compte
                      </button>
                    </>
                  )}
                </RowMenu>
              ) : (
                canAdd && (
                  <Button variant="ghost" size="xs" onClick={startAdding}>
                    <Plus /> Ajouter
                  </Button>
                )
              )}
              {canHandOver && (
                <RowMenu
                  label="Autres actions sur les comptes"
                  size="icon-xs"
                  trigger={<MoreHorizontal />}
                >
                  {(close) => (
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
                      onClick={() => {
                        close();
                        setOpenId(null);
                        setHandover(true);
                      }}
                    >
                      <Send className="size-4 text-muted-foreground" aria-hidden />
                      Remettre au candidat
                    </button>
                  )}
                </RowMenu>
              )}
            </>
          )
        }
      >
        {accounts.length === 0 && !adding ? (
          <span className="flex min-h-6 items-center text-muted-foreground">Aucun</span>
        ) : (
          <div className="w-full">
            {accounts.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Comptes du candidat">
                {accounts.map((a) => (
                  <AccountChip
                    key={a.id}
                    caseId={caseId}
                    account={a}
                    open={openId === a.id}
                    onOpenChange={(o) => setOpenId(o ? a.id : null)}
                    onEdit={
                      readOnly
                        ? undefined
                        : () => {
                            setOpenId(null);
                            setAdding(false);
                            setEditing(a.id);
                          }
                    }
                    onAssist={!readOnly && a.id === outlookToCreate?.id ? openAssistant : undefined}
                  />
                ))}
              </ul>
            )}
            {adding && (
              <AccountForm caseId={caseId} listId={listId} onDone={() => setAdding(false)} />
            )}
            {editedAccount && (
              <AccountForm
                key={editedAccount.id}
                caseId={caseId}
                listId={listId}
                account={editedAccount}
                onDone={() => setEditing(null)}
              />
            )}
          </div>
        )}
      </TrackRow>

      {assistant !== null && (
        <OutlookAssistant
          open={assistant === "open"}
          caseId={caseId}
          candidate={candidate}
          account={outlookToCreate}
          onClose={() => setAssistant("closed")}
          onSaved={() => setAssistant(null)}
        />
      )}
      {handover && (
        <AccountsHandover
          caseId={caseId}
          candidate={candidate.firstName}
          agencyName={agencyName}
          phone={candidate.phone}
          onClose={() => setHandover(false)}
        />
      )}
    </>
  );
}

// Largeur de la fiche d'un compte (w-80), pour l'ouvrir vers la gauche
// quand la pastille est trop près du bord droit
const PANEL_WIDTH = 320;

// Pastille d'un compte et sa fiche, ouverte sous elle. Téléphone : en bas
// de l'écran, comme les autres menus.
function AccountChip({
  caseId,
  account,
  open,
  onOpenChange,
  onEdit,
  onAssist,
}: {
  caseId: string;
  account: PinnedAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent : abonnement expiré, consultation seulement
  onEdit?: () => void;
  // Compte Outlook à créer : ouvre l'assistant
  onAssist?: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [alignEnd, setAlignEnd] = useState(false);
  const toCreate = account.status === "to_create";

  useDismiss(ref, open, onOpenChange);

  // Le focus passe dans la fiche à l'ouverture (lecteurs d'écran, clavier)
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      const { left } = buttonRef.current.getBoundingClientRect();
      setAlignEnd(left + PANEL_WIDTH > document.documentElement.clientWidth - 16);
    }
    onOpenChange(!open);
  }

  return (
    <li ref={ref} className="relative max-w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Compte ${account.platform}${toCreate ? ", à créer" : ""}`}
        title={account.login ?? undefined}
        onClick={toggle}
        className={cn(
          "touch-target flex h-6 max-w-full items-center gap-1 rounded-full border bg-card pr-1.5 pl-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "bg-muted",
          toCreate && "border-dashed text-muted-foreground",
        )}
      >
        <span className="truncate">{account.platform}</span>
        {toCreate && <span className="shrink-0 text-xs font-normal">à créer</span>}
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`Compte ${account.platform}`}
          tabIndex={-1}
          onKeyDown={(e) => {
            // Échap (refermée par useDismiss) : retour sur la pastille
            if (e.key === "Escape") buttonRef.current?.focus();
          }}
          className={cn(
            "absolute top-8 z-30 w-80 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
            alignEnd ? "right-0" : "left-0",
            "max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:right-4 max-sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-sm:left-4 max-sm:w-auto",
          )}
        >
          <AccountDetails
            caseId={caseId}
            account={account}
            onEdit={onEdit}
            onAssist={onAssist}
          />
        </div>
      )}
    </li>
  );
}

// Contenu de la fiche d'un compte. Démonté à la fermeture : un mot de passe
// affiché ne reste pas dans la page.
function AccountDetails({
  caseId,
  account,
  onEdit,
  onAssist,
}: {
  caseId: string;
  account: PinnedAccount;
  onEdit?: () => void;
  onAssist?: () => void;
}) {
  const [password, setPassword] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);
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

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{account.platform}</p>
        {account.url && (
          <a
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-link hover:underline"
          >
            Ouvrir le site <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      <dl className="space-y-2.5">
        {account.login && (
          <div>
            <dt className="text-xs text-muted-foreground">Identifiant</dt>
            <dd className="flex items-center gap-1">
              <span className="min-w-0 [overflow-wrap:anywhere]">{account.login}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                onClick={() => copy(account.login!, "login")}
                aria-label={`Copier l'identifiant ${account.platform}`}
                title="Copier l'identifiant"
              >
                {copied === "login" ? <Check /> : <Copy />}
              </Button>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Mot de passe</dt>
          <dd className="mt-0.5">
            {!isExisting ? (
              <span className="text-muted-foreground">
                {EXTERNAL_ACCOUNT_STATUS_LABELS.to_create}
              </span>
            ) : password === null ? (
              <Button
                variant="outline"
                size="xs"
                onClick={reveal}
                disabled={revealing}
                aria-label={`Afficher le mot de passe ${account.platform}`}
              >
                {revealing ? <Loader2 className="animate-spin" /> : <Eye />} Afficher
              </Button>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <code className="rounded-md bg-muted px-2 py-0.5 [overflow-wrap:anywhere]">
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
            )}
          </dd>
        </div>
      </dl>

      {password !== null && (
        <p className="text-xs text-muted-foreground">
          Cette consultation est notée dans l&apos;historique.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {onAssist && (
        <Button size="sm" className="w-full" onClick={onAssist}>
          <Mail /> Créer avec l&apos;assistant
        </Button>
      )}
      {onEdit && (
        <div className="border-t pt-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={onEdit}
            aria-label={`Modifier le compte ${account.platform}`}
          >
            <Pencil /> Modifier
          </Button>
        </div>
      )}
    </div>
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
    <form onSubmit={submit} className="grid gap-3 py-2 @xl:grid-cols-2">
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
        <div className="space-y-1 @xl:col-span-2">
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
            Il est chiffré et ne s&apos;affiche jamais dans les listes.
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive @xl:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 @xl:col-span-2">
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

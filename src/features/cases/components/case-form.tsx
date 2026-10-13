"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DIPLOMAS,
  DIPLOMA_LABELS,
  LANGUAGE_TESTS,
  LANGUAGE_TEST_LABELS,
  LEVEL_LABELS,
  LEVEL_ORDER,
  STATUS_LABELS,
  labelOf,
} from "@/features/cases/labels";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active?: boolean;
};

export type CaseInitial = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  educationLevel: string;
  mainTrack: string;
  schools: boolean;
  scope: string;
  assignedTo: string | null;
  diplomas: string[];
  languageTests: string[];
  pastelEmail?: string;
};

export type ImportMatch = {
  id: string;
  campaignLabel: string;
  isCurrent: boolean;
  status: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string | null;
  educationLevel: string;
  mainTrack: string | null;
  schools: boolean;
  scope: string;
  languageTests: string[];
  diplomas: string[];
  pastelAccount: "to_create" | "existing";
  pastelEmail: string | null;
};

export function CaseForm({
  mode,
  caseId,
  initial,
  members,
  currentUserId,
  isOwner,
}: {
  mode: "create" | "edit";
  caseId?: string;
  initial?: CaseInitial;
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [pastelAccount, setPastelAccount] = useState<"to_create" | "existing">(
    "to_create",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState<CaseInitial | null>(null);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  // Valeurs de départ : celles importées, sinon celles du dossier (modification)
  const init = imported ?? initial;

  function handleImport(m: ImportMatch) {
    const existing = m.pastelAccount === "existing";
    setImported({
      firstName: m.firstName,
      lastName: m.lastName,
      birthDate: m.birthDate,
      phone: m.phone,
      email: m.email ?? "",
      educationLevel: m.educationLevel,
      mainTrack: m.mainTrack ?? "",
      schools: m.schools,
      scope: m.scope,
      assignedTo: null,
      diplomas: m.diplomas,
      languageTests: m.languageTests,
      // Compte existant : seul l'e-mail est repris, le mot de passe est à ressaisir
      pastelEmail: existing ? (m.pastelEmail ?? "") : "",
    });
    setPastelAccount(existing ? "existing" : "to_create");
    setImportedFrom(m.campaignLabel);
    setError(null);
    setFieldErrors({});
    setFormKey((k) => k + 1);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const isExisting = pastelAccount === "existing";

    const common = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      birthDate: String(form.get("birthDate") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      educationLevel: String(form.get("educationLevel") ?? ""),
      mainTrack: String(form.get("mainTrack") ?? ""),
      schools: form.get("schools") === "on",
      scope: String(form.get("scope") ?? ""),
      assignedTo: isOwner ? String(form.get("assignedTo") ?? "") : "",
      languageTests: form.getAll("languageTests").map(String),
      diplomas: form.getAll("diplomas").map(String),
    };

    // En modification, aucun champ Pastel n'est envoyé
    const payload = isEdit
      ? common
      : {
          ...common,
          pastelAccount,
          pastelEmail: isExisting ? String(form.get("pastelEmail") ?? "") : "",
          pastelPassword: isExisting
            ? String(form.get("pastelPassword") ?? "")
            : "",
        };

    setLoading(true);
    const res = await fetch(isEdit ? `/api/cases/${caseId}` : "/api/cases", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (Array.isArray(data?.fields)) {
        const map: Record<string, string> = {};
        for (const f of data.fields as { path: string; message: string }[]) {
          if (!map[f.path]) map[f.path] = f.message;
        }
        setFieldErrors(map);
      }
      setError(data?.error ?? `Erreur serveur (${res.status})`);
      return;
    }

    if (isEdit) {
      // Retour à la fiche ; le rafraîchissement met à jour l'arbre
      router.push(`/cases/${caseId}`);
      router.refresh();
      return;
    }

    // Création réussie : direction la fiche du dossier créé
    router.push(`/cases/${data.id}`);
    router.refresh();
  }

  const assignedDefault = isEdit ? (init?.assignedTo ?? "") : currentUserId;

  return (
    <div className="space-y-4">
      {!isEdit && <ImportPanel onImport={handleImport} />}

      {importedFrom && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">
            Données importées de la campagne {importedFrom}.
          </p>
          <p className="mt-1">
            Vérifiez-les et modifiez ce qui a changé (le niveau d&apos;études,
            par exemple). L&apos;ancien dossier n&apos;est pas modifié :
            l&apos;enregistrement crée une nouvelle candidature.
          </p>
        </div>
      )}

      <form key={formKey} onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Candidat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={init?.firstName}
                required
              />
              <FieldError message={fieldErrors.firstName} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={init?.lastName}
                required
              />
              <FieldError message={fieldErrors.lastName} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={init?.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
              <FieldError message={fieldErrors.birthDate} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={init?.phone}
                required
              />
              <FieldError message={fieldErrors.phone} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">E-mail (facultatif)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={init?.email}
              />
              <FieldError message={fieldErrors.email} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classement du dossier</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="educationLevel">
                Niveau d&apos;études atteint ou en cours
              </Label>
              <select
                id="educationLevel"
                name="educationLevel"
                required
                defaultValue={init?.educationLevel ?? ""}
                className={selectClass}
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {LEVEL_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {LEVEL_LABELS[value]}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.educationLevel} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scope">Prestation</Label>
              <select
                id="scope"
                name="scope"
                required
                defaultValue={init?.scope ?? ""}
                className={selectClass}
              >
                <option value="" disabled>
                  Choisir...
                </option>
                <option value="application">Candidature</option>
                <option value="visa">Visa</option>
                <option value="both">Candidature et visa</option>
              </select>
              <FieldError message={fieldErrors.scope} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mainTrack">Procédure</Label>
              <select
                id="mainTrack"
                name="mainTrack"
                defaultValue={init?.mainTrack ?? ""}
                className={selectClass}
              >
                <option value="">Aucune</option>
                <option value="dap">DAP</option>
                <option value="non_dap">Hors-DAP</option>
              </select>
              <FieldError message={fieldErrors.mainTrack} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                id="schools"
                name="schools"
                type="checkbox"
                defaultChecked={init?.schools ?? false}
                className="size-4"
              />
              <Label htmlFor="schools">Écoles</Label>
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Choisissez au moins une procédure (DAP ou hors-DAP) ou cochez «
              Écoles ».
            </p>
            {isOwner ? (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="assignedTo">Responsable du dossier</Label>
                <select
                  id="assignedTo"
                  name="assignedTo"
                  defaultValue={assignedDefault}
                  className={selectClass}
                >
                  {isEdit && !init?.assignedTo && (
                    <option value="">Aucun (non attribué)</option>
                  )}
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                      {m.id === currentUserId ? " (moi)" : ""}
                      {m.is_active === false ? " (inactif)" : ""}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors.assignedTo} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {isEdit
                  ? "Seul le patron peut changer le responsable du dossier."
                  : "Ce dossier vous sera affecté automatiquement."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pièces à prévoir</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Diplômes obtenus</legend>
              {DIPLOMAS.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    id={`diploma-${value}`}
                    name="diplomas"
                    type="checkbox"
                    value={value}
                    defaultChecked={init?.diplomas.includes(value) ?? false}
                    className="size-4"
                  />
                  <Label htmlFor={`diploma-${value}`}>
                    {DIPLOMA_LABELS[value]}
                  </Label>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Ne rien cocher si le candidat n&apos;a aucun diplôme.
              </p>
              <FieldError message={fieldErrors.diplomas} />
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tests de langue</legend>
              {LANGUAGE_TESTS.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    id={`test-${value}`}
                    name="languageTests"
                    type="checkbox"
                    value={value}
                    defaultChecked={
                      init?.languageTests.includes(value) ?? false
                    }
                    className="size-4"
                  />
                  <Label htmlFor={`test-${value}`}>
                    {LANGUAGE_TEST_LABELS[value]}
                  </Label>
                </div>
              ))}
              <FieldError message={fieldErrors.languageTests} />
            </fieldset>
          </CardContent>
        </Card>

        {isEdit ? (
          <p className="text-sm text-muted-foreground">
            Le compte Pastel et son mot de passe ne se modifient pas ici.
          </p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Compte Pastel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pastelAccount">Compte</Label>
                <select
                  id="pastelAccount"
                  value={pastelAccount}
                  onChange={(e) =>
                    setPastelAccount(e.target.value as "to_create" | "existing")
                  }
                  className={selectClass}
                >
                  <option value="to_create">À créer</option>
                  <option value="existing">Existant</option>
                </select>
              </div>

              {pastelAccount === "existing" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="pastelEmail">E-mail du compte Pastel</Label>
                    <Input
                      id="pastelEmail"
                      name="pastelEmail"
                      type="email"
                      autoComplete="off"
                      defaultValue={init?.pastelEmail}
                      required
                    />
                    <FieldError message={fieldErrors.pastelEmail} />
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
                      required
                    />
                    <FieldError message={fieldErrors.pastelPassword} />
                  </div>
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Le mot de passe est chiffré avant d&apos;être enregistré et
                    n&apos;apparaît jamais dans les listes.
                    {importedFrom
                      ? " Le mot de passe de l'ancien compte n'est jamais repris : saisissez-le à nouveau."
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Le compte sera créé plus tard. L&apos;e-mail et le mot de
                  passe seront à renseigner depuis la fiche du dossier.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {isEdit
              ? loading
                ? "Enregistrement..."
                : "Enregistrer les modifications"
              : loading
                ? "Création..."
                : "Créer le dossier"}
          </Button>
          {isEdit && (
            <Link
              href={`/cases/${caseId}`}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
            >
              Annuler
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}

function ImportPanel({ onImport }: { onImport: (m: ImportMatch) => void }) {
  const [open, setOpen] = useState(false);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ImportMatch[] | null>(null);

  async function search() {
    setError(null);
    setMatches(null);
    setLoading(true);
    const res = await fetch("/api/cases/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastName, firstName, birthDate }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !Array.isArray(data?.matches)) {
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }
    setMatches(data.matches as ImportMatch[]);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Importer depuis une ancienne campagne
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer depuis une ancienne campagne</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Retrouvez le candidat pour reprendre ses informations. Un nouveau
          dossier sera créé dans la campagne en cours ; l&apos;ancien reste
          inchangé.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="importLastName">Nom</Label>
            <Input
              id="importLastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="importFirstName">Prénom</Label>
            <Input
              id="importFirstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="importBirthDate">Date de naissance</Label>
            <Input
              id="importBirthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={search}
            disabled={
              loading || !lastName.trim() || !firstName.trim() || !birthDate
            }
          >
            {loading ? "Recherche..." : "Rechercher"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setMatches(null);
              setError(null);
            }}
          >
            Fermer
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {matches && matches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun dossier trouvé pour ce nom, ce prénom et cette date de
            naissance dans votre agence.
          </p>
        )}

        {matches && matches.length > 0 && (
          <ul className="divide-y rounded-md border">
            {matches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <span>
                  {m.lastName.toLocaleUpperCase("fr")} {m.firstName} · Campagne{" "}
                  {m.campaignLabel} ·{" "}
                  {labelOf(LEVEL_LABELS, m.educationLevel)} ·{" "}
                  {labelOf(STATUS_LABELS, m.status)}
                </span>
                {m.isCurrent ? (
                  <span className="flex items-center gap-2">
                    <span className="text-amber-700">
                      Déjà présent dans la campagne en cours
                    </span>
                    <Link href={`/cases/${m.id}`} className="underline">
                      Ouvrir
                    </Link>
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onImport(m);
                      setOpen(false);
                      setMatches(null);
                    }}
                  >
                    Importer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

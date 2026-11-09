"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Pencil } from "lucide-react";
import {
  FieldError,
  SelectField,
  TextAreaField,
  TextField,
  optionsOf,
} from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import {
  EMPTY_CASE_FIELDS,
  caseFieldsPayload,
  type CaseFieldsDraft,
} from "@/features/cases/case-record";
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS, labelOf } from "@/features/cases/labels";
import { DiplomasEditor, LanguageTestsEditor } from "@/features/cases/components/case-form-lists";
import { callApi } from "@/lib/api-client";
import { formatLongDate } from "@/lib/dates";
import { telHref } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { MAX_SIGNUP_MESSAGE, signupSubmitSchema } from "../schemas";

// Formulaire public d'inscription en ligne, en quatre étapes courtes (sur
// téléphone surtout) : chaque étape est vérifiée avant de passer à la
// suivante, avec les règles du serveur. Une erreur renvoyée par le serveur
// ramène à l'étape du champ concerné.

const STEPS = [
  { title: "Vous", description: "Vos coordonnées, pour que l'agence vous recontacte." },
  { title: "Projet", description: "La campagne qui vous intéresse et votre projet." },
  { title: "Parcours", description: "Votre niveau d'études, vos diplômes et tests de langue." },
  { title: "Envoi", description: "Vérifiez vos informations avant de les envoyer." },
] as const;

// Étape de chaque champ (premier élément du chemin de l'erreur)
const STEP_OF: Record<string, number> = {
  firstName: 0,
  lastName: 0,
  birthDate: 0,
  phone: 0,
  email: 0,
  city: 0,
  nationality: 0,
  secondaryContactName: 0,
  secondaryContactPhone: 0,
  campaignId: 1,
  message: 1,
  educationLevel: 2,
  currentField: 2,
  currentInstitution: 2,
  diplomas: 2,
  languageTests: 2,
  consent: 3,
};

const stepOf = (path: string) => STEP_OF[path.split(".")[0]] ?? 3;

type Draft = {
  fields: CaseFieldsDraft;
  campaignId: string;
  message: string;
  consent: boolean;
  // Piège à robots : reste vide pour un humain
  website: string;
};

export function SignupForm({
  slug,
  agencyName,
  agencyPhone,
  campaigns,
}: {
  slug: string;
  agencyName: string;
  agencyPhone: string;
  campaigns: { id: string; name: string }[];
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    fields: EMPTY_CASE_FIELDS,
    // Une seule campagne : rien à choisir
    campaignId: campaigns.length === 1 ? campaigns[0].id : "",
    message: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const f = draft.fields;
  const set =
    <K extends keyof CaseFieldsDraft>(key: K) =>
    (value: CaseFieldsDraft[K]) =>
      setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));
  const campaign = campaigns.find((c) => c.id === draft.campaignId) ?? null;

  function payload() {
    return {
      ...caseFieldsPayload(f),
      campaignId: draft.campaignId,
      message: draft.message,
      consent: draft.consent,
      website: draft.website,
    };
  }

  // Erreurs des étapes jusqu'à `upTo` comprise (règles du serveur)
  function check(upTo: number) {
    const parsed = signupSubmitSchema.safeParse(payload());
    const found: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (stepOf(path) <= upTo && !found[path]) found[path] = issue.message;
      }
    }
    return found;
  }

  function goTo(next: number) {
    setStep(next);
    setError(null);
    // Le titre de l'étape prend le focus : lu par les lecteurs d'écran, et
    // la page remonte en haut du formulaire
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function showErrors(found: Record<string, string>) {
    setErrors(found);
    const first = Math.min(...Object.keys(found).map(stepOf));
    if (first !== step) goTo(first);
    setError("Certaines informations sont à corriger.");
  }

  function next() {
    const found = check(step);
    if (Object.keys(found).length > 0) return showErrors(found);
    setErrors({});
    goTo(step + 1);
  }

  async function submit() {
    const found = check(STEPS.length - 1);
    if (Object.keys(found).length > 0) return showErrors(found);
    setErrors({});
    setError(null);
    setLoading(true);
    const res = await callApi(`/api/inscription/${slug}`, { body: payload() });
    setLoading(false);
    if (!res.ok) {
      if (Object.keys(res.fieldErrors).length > 0) return showErrors(res.fieldErrors);
      return setError(res.error);
    }
    setSent(true);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  if (sent) {
    return (
      <section className="mt-8 rounded-2xl border bg-card p-6 text-center md:p-8">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-semibold outline-none">
          Demande envoyée
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {agencyName} a bien reçu vos informations et va vous contacter
          {f.phone ? ` au ${f.phone}` : ""}. Vous pouvez aussi l&apos;appeler au{" "}
          <a href={telHref(agencyPhone)} className="font-medium text-link hover:underline">
            {agencyPhone}
          </a>
          .
        </p>
      </section>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const levelOptions = optionsOf(EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (last) void submit();
        else next();
      }}
      className="mt-8 space-y-5"
    >
      <p className="text-sm text-muted-foreground">
        Inscrivez-vous en 3 minutes : l&apos;agence reçoit votre demande et vous recontacte.
      </p>

      {/* Étapes : numéros sur téléphone, titres à partir de la tablette */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined} className="min-w-0">
            <span
              className={cn(
                "block h-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block truncate text-xs",
                i === step ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="sm:hidden">{i + 1}</span>
              <span className="max-sm:sr-only">
                {i + 1}. {s.title}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <section className="@container space-y-5 rounded-2xl border bg-card p-5 md:p-6">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            <span className="sr-only">
              Étape {step + 1} sur {STEPS.length} :{" "}
            </span>
            {current.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        </div>

        {step === 0 && (
          <>
            <div className="grid gap-4 @md:grid-cols-2">
              <TextField id="firstName" label="Prénom" required maxLength={100}
                autoComplete="given-name"
                value={f.firstName} onChange={set("firstName")} error={errors.firstName} />
              <TextField id="lastName" label="Nom" required maxLength={100}
                autoComplete="family-name"
                value={f.lastName} onChange={set("lastName")} error={errors.lastName} />
              <TextField id="birthDate" label="Date de naissance" type="date" required
                autoComplete="bday"
                value={f.birthDate} onChange={set("birthDate")} error={errors.birthDate} />
              <TextField id="phone" label="Téléphone" type="tel" required maxLength={30}
                autoComplete="tel" placeholder="0555 12 34 56"
                value={f.phone} onChange={set("phone")} error={errors.phone} />
              <TextField id="email" label="E-mail" type="email" maxLength={254}
                autoComplete="email"
                value={f.email} onChange={set("email")} error={errors.email} />
              <TextField id="city" label="Ville ou wilaya" maxLength={100}
                autoComplete="address-level2"
                value={f.city} onChange={set("city")} error={errors.city} />
              <TextField id="nationality" label="Nationalité" maxLength={100}
                value={f.nationality} onChange={set("nationality")} error={errors.nationality} />
            </div>
            <fieldset className="space-y-3 border-t pt-5">
              <legend className="sr-only">Un proche à contacter</legend>
              <p className="text-sm font-medium">
                Un proche à contacter{" "}
                <span className="font-normal text-muted-foreground">(facultatif, un parent par exemple)</span>
              </p>
              <div className="grid gap-4 @md:grid-cols-2">
                <TextField id="secondaryContactName" label="Son nom" maxLength={100}
                  value={f.secondaryContactName} onChange={set("secondaryContactName")}
                  error={errors.secondaryContactName} />
                <TextField id="secondaryContactPhone" label="Son téléphone" type="tel" maxLength={30}
                  value={f.secondaryContactPhone} onChange={set("secondaryContactPhone")}
                  error={errors.secondaryContactPhone} />
              </div>
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            {campaigns.length > 1 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Campagne
                  <span aria-hidden className="text-destructive">
                    *
                  </span>
                </legend>
                <div className="grid gap-2 @md:grid-cols-2">
                  {campaigns.map((c) => {
                    const checked = draft.campaignId === c.id;
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                          checked ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name="campaignId"
                          value={c.id}
                          checked={checked}
                          onChange={() => setDraft((d) => ({ ...d, campaignId: c.id }))}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 font-medium break-words">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                <FieldError message={errors.campaignId} />
              </fieldset>
            ) : (
              <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-sm">
                Campagne : <span className="font-medium">{campaigns[0]?.name}</span>
              </p>
            )}
            <TextAreaField
              id="message"
              label="Votre projet en quelques mots"
              maxLength={MAX_SIGNUP_MESSAGE}
              placeholder="Formation visée, ville, questions pour l'agence…"
              value={draft.message}
              onChange={(message) => setDraft((d) => ({ ...d, message }))}
              error={errors.message}
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 @md:grid-cols-2">
              <SelectField id="educationLevel" label="Niveau d'études atteint" required
                value={f.educationLevel} onChange={set("educationLevel")}
                options={levelOptions} placeholder="Choisir…" error={errors.educationLevel}
                className="@md:col-span-2" />
              <TextField id="currentField" label="Filière ou spécialité" maxLength={150}
                value={f.currentField} onChange={set("currentField")} error={errors.currentField} />
              <TextField id="currentInstitution" label="Établissement actuel" maxLength={150}
                value={f.currentInstitution} onChange={set("currentInstitution")}
                error={errors.currentInstitution} />
            </div>
            <div className="border-t pt-5">
              <DiplomasEditor value={f.diplomas} onChange={set("diplomas")} errors={errors} />
            </div>
            <div className="border-t pt-5">
              <LanguageTestsEditor value={f.languageTests} onChange={set("languageTests")}
                errors={errors} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <dl className="divide-y rounded-xl border text-sm">
              <Summary label="Nom" onEdit={() => goTo(0)}>
                {[f.firstName, f.lastName].join(" ")}
              </Summary>
              <Summary label="Date de naissance" onEdit={() => goTo(0)}>
                {f.birthDate && formatLongDate(f.birthDate)}
              </Summary>
              <Summary label="Téléphone" onEdit={() => goTo(0)}>
                {f.phone}
              </Summary>
              {f.email && (
                <Summary label="E-mail" onEdit={() => goTo(0)}>
                  {f.email}
                </Summary>
              )}
              <Summary label="Campagne" onEdit={() => goTo(1)}>
                {campaign?.name}
              </Summary>
              <Summary label="Niveau d'études" onEdit={() => goTo(2)}>
                {f.educationLevel && labelOf(EDUCATION_LEVEL_LABELS, f.educationLevel)}
              </Summary>
            </dl>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.consent}
                  onChange={(e) => setDraft((d) => ({ ...d, consent: e.target.checked }))}
                  aria-invalid={errors.consent ? true : undefined}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  J&apos;accepte que ces informations soient transmises à {agencyName} pour
                  traiter ma demande.{" "}
                  <Link href="/confidentialite" target="_blank" className="text-link underline-offset-2 hover:underline">
                    Confidentialité
                  </Link>
                </span>
              </label>
              <FieldError message={errors.consent} />
            </div>
          </>
        )}

        {/* Piège à robots : hors de l'écran, ignoré des lecteurs d'écran et
            du clavier */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Site web</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={draft.website}
            onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={loading}>
            <ArrowLeft /> Retour
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" /> Envoi…
            </>
          ) : last ? (
            "Envoyer ma demande"
          ) : (
            <>
              Continuer <ArrowRight />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Ligne du récapitulatif, avec un lien vers l'étape à corriger
function Summary({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <dt className="w-32 shrink-0 text-muted-foreground max-sm:w-24">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words">{children}</dd>
      <button
        type="button"
        onClick={onEdit}
        className="touch-target grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-3.5" aria-hidden />
        <span className="sr-only">Modifier : {label}</span>
      </button>
    </div>
  );
}

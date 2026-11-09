"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import { FieldError } from "@/components/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SaveFooter, useSettingsSave } from "@/features/settings/components/save-footer";
import { SIGNUP_PATH } from "../schemas";
import { SignupLink } from "./signup-link";

type Draft = { enabled: boolean; slug: string; campaignIds: string[] };

// Réglages (patron) : ouvrir la page d'inscription en ligne, choisir son
// adresse et les campagnes proposées aux candidats. Une fois la page
// ouverte et enregistrée, son adresse se partage d'ici.
export function SignupSettingsForm({
  initial,
  savedSlug,
  campaigns,
  site,
  agencyName,
  readOnly,
}: {
  initial: Draft;
  // Adresse enregistrée (null : jamais choisie)
  savedSlug: string | null;
  // Campagnes actives de l'agence
  campaigns: { id: string; name: string }[];
  // Adresse du site, sans « / » final
  site: string;
  agencyName: string;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const { save, dirty, saving, saved, error, errors } = useSettingsSave(
    "/api/settings/signup",
    draft,
    initial,
  );
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const prefix = `${site.replace(/^https?:\/\//, "")}${SIGNUP_PATH}/`;
  const slugChanged = savedSlug !== null && draft.slug.trim() !== savedSlug;
  // Adresse à partager : celle enregistrée, page ouverte avec au moins une
  // campagne, sans modification en cours
  const shareable =
    !dirty && isLive(draft) && savedSlug ? `${site}${SIGNUP_PATH}/${savedSlug}` : null;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <fieldset disabled={readOnly} className="space-y-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">Page d&apos;inscription ouverte</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Les candidats y envoient leurs informations ; chaque demande arrive en haut de
              l&apos;arbre des dossiers, à accepter ou refuser.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="signup-slug" className="gap-0.5">
            Adresse de la page
            {draft.enabled && (
              <span aria-hidden className="text-destructive">
                *
              </span>
            )}
          </Label>
          <div
            className={cn(
              "flex h-10 items-center overflow-hidden rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
              errors.slug && "border-destructive",
            )}
          >
            <span className="shrink-0 truncate border-r bg-muted/50 px-3 text-sm text-muted-foreground max-sm:max-w-[45%]">
              {prefix}
            </span>
            <Input
              id="signup-slug"
              value={draft.slug}
              onChange={(e) => patch({ slug: e.target.value.toLowerCase() })}
              maxLength={50}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby="signup-slug-hint"
              className="h-full rounded-none border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          {!errors.slug && (
            <p id="signup-slug-hint" className="text-xs text-muted-foreground">
              Lettres sans accent, chiffres et tirets, par exemple atlas-etudes.
            </p>
          )}
          <FieldError message={errors.slug} />
          {slugChanged && draft.enabled && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              L&apos;ancienne adresse ne fonctionnera plus : pensez à changer les liens déjà partagés.
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Campagnes proposées</legend>
          <p className="text-xs text-muted-foreground">
            Le candidat choisit l&apos;une d&apos;elles (s&apos;il n&apos;y en a qu&apos;une, il n&apos;a
            rien à choisir). Sans campagne cochée, la page reste fermée.
          </p>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune campagne active.{" "}
              <Link href="/campaigns" className="font-medium text-link underline-offset-2 hover:underline">
                Créez-en une
              </Link>{" "}
              pour ouvrir la page.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {campaigns.map((c) => {
                const checked = draft.campaignIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      checked
                        ? "border-primary/40 bg-accent text-accent-foreground"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) =>
                        patch({
                          campaignIds: e.target.checked
                            ? [...draft.campaignIds, c.id]
                            : draft.campaignIds.filter((id) => id !== c.id),
                        })
                      }
                    />
                    {checked && <Check className="size-3.5" aria-hidden />}
                    {c.name}
                  </label>
                );
              })}
            </div>
          )}
          <FieldError message={errors.campaignIds} />
        </fieldset>
      </fieldset>

      {shareable && (
        <div className="space-y-2 border-t pt-5">
          <p className="text-sm font-medium">Votre page est en ligne</p>
          <SignupLink url={shareable} agencyName={agencyName} />
        </div>
      )}

      {!readOnly && <SaveFooter saving={saving} saved={saved} dirty={dirty} error={error} />}
    </form>
  );
}

// Page ouverte à des candidats : activée, avec au moins une campagne
function isLive(d: Draft) {
  return d.enabled && d.campaignIds.length > 0;
}

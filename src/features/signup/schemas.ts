import { z } from "zod";
import { caseFieldsSchema } from "@/features/cases/schemas";
import { emptyToUndefined, uuidSchema } from "@/lib/validation";

// Inscription en ligne : page publique d'une agence, où un candidat envoie
// une demande. Règles partagées entre le navigateur et le serveur ; la base
// impose les mêmes limites (migration online_signups).

export const SIGNUP_PATH = "/inscription";
export const MAX_SIGNUP_MESSAGE = 1000;
// Demandes sans réponse : supprimées après ce délai
export const SIGNUP_RETENTION_DAYS = 90;

const SLUG_MIN = 3;
const SLUG_MAX = 50;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Adresse de la page : minuscules, chiffres et tirets
export const signupSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `${SLUG_MIN} caractères au moins`)
  .max(SLUG_MAX, `${SLUG_MAX} caractères au maximum`)
  .regex(SLUG_PATTERN, "Lettres sans accent, chiffres et tirets seulement (ex. : atlas-etudes)");

export function isSignupSlug(value: string) {
  return value.length >= SLUG_MIN && value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

// Adresse proposée à partir du nom de l'agence : « Atlas Études » →
// « atlas-etudes ». Trop courte, elle est complétée.
export function slugFromName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  return slug.length >= SLUG_MIN ? slug : `${slug ? `${slug}-` : ""}agence`;
}

// Réglages du patron. Page activée : une adresse est obligatoire.
export const signupSettingsSchema = z
  .object({
    enabled: z.boolean(),
    slug: z.preprocess(emptyToUndefined, signupSlugSchema.optional()),
    campaignIds: z.array(uuidSchema).max(30),
  })
  .superRefine((s, ctx) => {
    if (s.enabled && !s.slug) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Choisissez l'adresse de la page" });
    }
  });

export type SignupSettingsInput = z.infer<typeof signupSettingsSchema>;

// Envoi du candidat : les champs du dossier, la campagne choisie, un
// message facultatif et son accord. `website` est un piège à robots : un
// champ caché qu'un humain laisse vide.
export const signupSubmitSchema = caseFieldsSchema.and(
  z.object({
    // Vide (rien de choisi) ou invalide : une seule erreur
    campaignId: z.string().uuid("Choisissez une campagne"),
    message: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(MAX_SIGNUP_MESSAGE, `${MAX_SIGNUP_MESSAGE} caractères au maximum`)
        .optional(),
    ),
    consent: z.literal(true, "Cochez la case pour envoyer votre demande"),
    website: z.string().max(200).optional(),
  }),
);

export type SignupSubmitInput = z.infer<typeof signupSubmitSchema>;

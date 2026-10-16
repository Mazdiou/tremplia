import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

// Briques de validation partagées par les formulaires et les routes.
// La base impose les mêmes limites.

// Chaîne vide ou faite d'espaces : valeur absente
export const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const tooLong = (max: number) => `${max} caractères au maximum`;

// Texte obligatoire, sans espaces autour
export function requiredText(max: number, emptyMessage = "Champ obligatoire") {
  return z.string().trim().min(1, emptyMessage).max(max, tooLong(max));
}

// Texte facultatif (une ou plusieurs lignes) : vide = absent
export function optionalText(max: number) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max, tooLong(max)).optional(),
  );
}

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Numéro trop court")
  .max(30, "Numéro trop long");

export const optionalPhoneSchema = z.preprocess(
  emptyToUndefined,
  phoneSchema.optional(),
);

export const optionalEmailSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("E-mail invalide").max(254).optional(),
);

export const isoDateSchema = z.string().refine(isIsoDate, "Date invalide");

export const optionalIsoDateSchema = z.preprocess(
  emptyToUndefined,
  isoDateSchema.optional(),
);

export const uuidSchema = z.string().uuid("Identifiant invalide");

// Identifiant venu d'une adresse : inutile d'interroger la base sinon
export const isUuid = (value: string) => uuidSchema.safeParse(value).success;

export const optionalUuidSchema = z.preprocess(
  emptyToUndefined,
  uuidSchema.optional(),
);

// Aucun doublon, majuscules ignorées (« Pastel » = « PASTEL »)
export function isUniqueIgnoringCase(values: string[]) {
  return (
    new Set(values.map((v) => v.toLocaleLowerCase("fr"))).size === values.length
  );
}

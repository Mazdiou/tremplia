import { z } from "zod";
import {
  DIPLOMAS,
  LANGUAGE_TESTS,
  LEVEL_ORDER,
  SCOPES,
  TRACKS,
} from "./labels";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email().max(254).optional(),
);

// Champs communs à la création et à la modification
const caseShape = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  birthDate: z
    .string()
    .refine(isRealDate, "Date invalide")
    .refine(
      (v) => v > "1900-01-01" && v <= new Date().toISOString().slice(0, 10),
      "Date de naissance hors limites",
    ),
  phone: z.string().trim().min(6).max(30),
  email: optionalEmail,
  educationLevel: z.enum(LEVEL_ORDER),
  mainTrack: z.preprocess(
    emptyToUndefined,
    z.enum(TRACKS).optional(),
  ),
  schools: z.boolean(),
  scope: z.enum(SCOPES),
  assignedTo: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  languageTests: z.array(z.enum(LANGUAGE_TESTS)).max(LANGUAGE_TESTS.length),
  diplomas: z.array(z.enum(DIPLOMAS)).max(DIPLOMAS.length),
};

function checkTrack(
  d: { mainTrack?: string; schools: boolean },
  ctx: z.RefinementCtx,
) {
  if (!d.mainTrack && !d.schools) {
    ctx.addIssue({
      code: "custom",
      path: ["mainTrack"],
      message: "Choisissez DAP, hors-DAP ou écoles",
    });
  }
}

export const createCaseSchema = z
  .object({
    ...caseShape,
    pastelAccount: z.enum(["to_create", "existing"]),
    pastelEmail: optionalEmail,
    pastelPassword: z.preprocess(
      emptyToUndefined,
      z.string().min(1).max(200).optional(),
    ),
  })
  .superRefine((d, ctx) => {
    checkTrack(d, ctx);
    if (d.pastelAccount === "existing") {
      if (!d.pastelEmail) {
        ctx.addIssue({
          code: "custom",
          path: ["pastelEmail"],
          message: "E-mail Pastel requis",
        });
      }
      if (!d.pastelPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["pastelPassword"],
          message: "Mot de passe Pastel requis",
        });
      }
    }
  });

// Modification : jamais de champ Pastel (les clés inconnues sont ignorées).
// assignedTo absent = responsable inchangé.
export const updateCaseSchema = z.object(caseShape).superRefine(checkTrack);

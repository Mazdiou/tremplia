import { z } from "zod";
import { noteContentSchema } from "@/features/notes/schemas";
import {
  initialPaymentSchema,
  optionalAmountSchema,
} from "@/features/payments/schemas";
import { todayInAppTimezone } from "@/lib/dates";
import {
  emptyToUndefined,
  isoDateSchema,
  isUniqueIgnoringCase,
  optionalEmailSchema,
  optionalIsoDateSchema,
  optionalPhoneSchema,
  optionalText,
  optionalUuidSchema,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "@/lib/validation";
import {
  CASE_STATUSES,
  DIPLOMA_TYPES,
  EDUCATION_LEVELS,
  EXTERNAL_ACCOUNT_STATUSES,
  LANGUAGE_TESTS,
  MAX_DIPLOMAS,
  MAX_EXTERNAL_ACCOUNTS,
  MAX_LANGUAGE_TESTS,
} from "./labels";

// Schémas partagés par les formulaires et les routes. La base impose les
// mêmes limites (migration cases).

const diplomaSchema = z.object({
  type: z.enum(DIPLOMA_TYPES, "Choisissez un type de diplôme"),
  title: optionalText(150),
  year: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z
      .number("Année invalide")
      .int("Année invalide")
      .min(1950, "Année invalide")
      .refine((y) => y <= new Date().getFullYear() + 1, "Année invalide")
      .optional(),
  ),
});

const languageTestSchema = z
  .object({
    test: z.enum(LANGUAGE_TESTS, "Choisissez un test"),
    otherName: optionalText(100),
    result: optionalText(50),
    date: optionalIsoDateSchema,
  })
  .superRefine((t, ctx) => {
    if (t.test === "other" && !t.otherName) {
      ctx.addIssue({
        code: "custom",
        path: ["otherName"],
        message: "Précisez le nom du test",
      });
    }
  });

// Champs du dossier communs à la création et à la modification
const caseFieldsShape = {
  firstName: requiredText(100, "Saisissez le prénom"),
  lastName: requiredText(100, "Saisissez le nom"),
  birthDate: isoDateSchema.refine(
    (v) => v > "1900-01-01" && v <= todayInAppTimezone(),
    "Date de naissance hors limites",
  ),
  phone: phoneSchema,
  email: optionalEmailSchema,
  city: optionalText(100),
  nationality: optionalText(100),
  secondaryContactName: optionalText(100),
  secondaryContactPhone: optionalPhoneSchema,
  educationLevel: z.enum(EDUCATION_LEVELS, "Choisissez le niveau d'études"),
  currentField: optionalText(150),
  currentInstitution: optionalText(150),
  diplomas: z
    .array(diplomaSchema)
    .max(MAX_DIPLOMAS, `${MAX_DIPLOMAS} diplômes au maximum`),
  languageTests: z
    .array(languageTestSchema)
    .max(MAX_LANGUAGE_TESTS, `${MAX_LANGUAGE_TESTS} tests au maximum`),
};

// Contact secondaire : nom et téléphone, ou aucun des deux
function checkSecondaryContact(
  d: { secondaryContactName?: string; secondaryContactPhone?: string },
  ctx: z.RefinementCtx,
) {
  if (d.secondaryContactName && !d.secondaryContactPhone) {
    ctx.addIssue({
      code: "custom",
      path: ["secondaryContactPhone"],
      message: "Ajoutez le téléphone du contact",
    });
  }
  if (!d.secondaryContactName && d.secondaryContactPhone) {
    ctx.addIssue({
      code: "custom",
      path: ["secondaryContactName"],
      message: "Ajoutez le nom du contact",
    });
  }
}

export const caseFieldsSchema = z
  .object(caseFieldsShape)
  .superRefine(checkSecondaryContact);

export type CaseFields = z.infer<typeof caseFieldsSchema>;

// Comptes externes ------------------------------------------------------------

const externalAccountShape = {
  platform: requiredText(80, "Saisissez la plateforme"),
  url: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "Adresse trop longue")
      .regex(/^https?:\/\/\S+$/i, "Adresse invalide (http:// ou https://)")
      .optional(),
  ),
  login: optionalText(254),
  status: z.enum(EXTERNAL_ACCOUNT_STATUSES),
  // Jamais modifié (ni espaces retirés) : c'est un secret
  password: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().max(200, "Mot de passe trop long").optional(),
  ),
};

type AccountDraft = {
  status: (typeof EXTERNAL_ACCOUNT_STATUSES)[number];
  login?: string;
  password?: string;
};

// `passwordRequired` : à la création d'un compte existant. Ensuite, un mot
// de passe absent garde l'ancien.
function checkAccount(passwordRequired: boolean) {
  return (a: AccountDraft, ctx: z.RefinementCtx) => {
    if (a.status === "existing") {
      if (!a.login) {
        ctx.addIssue({ code: "custom", path: ["login"], message: "Identifiant requis" });
      }
      if (passwordRequired && !a.password) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Mot de passe requis",
        });
      }
    } else if (a.password) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Pas de mot de passe pour un compte à créer",
      });
    }
  };
}

export const newExternalAccountSchema = z
  .object(externalAccountShape)
  .superRefine(checkAccount(true));

export const externalAccountUpdateSchema = z
  .object(externalAccountShape)
  .superRefine(checkAccount(false));

export type ExternalAccountInput = z.infer<typeof newExternalAccountSchema>;

// Création et modification ----------------------------------------------------

const optionalNote = z.preprocess(emptyToUndefined, noteContentSchema.optional());

export const createCaseSchema = z
  .object({
    campaignId: uuidSchema,
    groupIds: z.array(uuidSchema).max(30),
    // Ignoré pour un employé : il est toujours responsable de ses dossiers
    assignedTo: optionalUuidSchema,
    ...caseFieldsShape,
    externalAccounts: z
      .array(newExternalAccountSchema)
      .max(MAX_EXTERNAL_ACCOUNTS, `${MAX_EXTERNAL_ACCOUNTS} comptes au maximum`)
      .refine(
        (list) => isUniqueIgnoringCase(list.map((a) => a.platform)),
        "Un seul compte par plateforme",
      ),
    initialNote: optionalNote,
    // Montant convenu (facultatif) et paiement fait le jour même (absent :
    // rien payé aujourd'hui)
    agreedAmount: optionalAmountSchema,
    initialPayment: initialPaymentSchema.optional(),
    // Campagne d'où viennent les données importées (journal seulement)
    sourceCampaignId: optionalUuidSchema,
    // Création confirmée malgré un doublon possible
    confirmDuplicate: z.boolean().optional(),
  })
  .superRefine(checkSecondaryContact)
  .superRefine((d, ctx) => {
    if (!d.initialPayment) return;
    if (d.agreedAmount === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["agreedAmount"],
        message: "Indiquez le montant convenu",
      });
    } else if (d.initialPayment.amount > d.agreedAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["initialPayment", "amount"],
        message: "Le paiement dépasse le montant convenu",
      });
    }
  });

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

// Modification : la campagne, les comptes externes et la note initiale ne
// se modifient pas ici. assignedTo absent = responsable inchangé.
export const updateCaseSchema = z
  .object({ ...caseFieldsShape, assignedTo: optionalUuidSchema })
  .superRefine(checkSecondaryContact);

export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

// completeTasks : à la clôture, marquer faites les tâches à faire du dossier
export const caseStatusSchema = z.object({
  status: z.enum(CASE_STATUSES),
  completeTasks: z.boolean().optional(),
});

export const caseGroupsSchema = z.object({
  groupIds: z.array(uuidSchema).max(30),
});

// Recherches : en POST, jamais l'identité d'un candidat dans une adresse
export const importLookupSchema = z.object({
  sourceCampaignId: uuidSchema,
  lastName: requiredText(100, "Saisissez le nom"),
  firstName: requiredText(100, "Saisissez le prénom"),
  birthDate: isoDateSchema,
});

// Nombre maximal de résultats de la recherche globale
export const CASE_SEARCH_LIMIT = 20;

export const caseSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Saisissez au moins 2 caractères")
    .max(100, "Recherche trop longue"),
});

// Actions groupées : même étape ou même responsable pour plusieurs dossiers.
// Limite partagée avec la base (migration bulk_case_actions).
export const BULK_MAX_CASES = 200;

export const bulkCasesSchema = z.object({
  caseIds: z
    .array(uuidSchema)
    .min(1, "Sélectionnez au moins un dossier")
    .max(BULK_MAX_CASES, `${BULK_MAX_CASES} dossiers au plus à la fois`),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("stage"), stageId: uuidSchema }),
    z.object({ type: z.literal("assignee"), assignedTo: uuidSchema }),
  ]),
});

export type BulkCasesInput = z.infer<typeof bulkCasesSchema>;

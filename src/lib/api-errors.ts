import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isUuid } from "@/lib/validation";
import { reportError, reportException } from "@/lib/report-error";

// Réponses sans cache : elles peuvent contenir un lien signé ou un secret.
const NO_STORE = { "Cache-Control": "no-store" };

type FieldError = { path: string; message: string };

// Erreur prévue, au message français prêt à afficher (jamais de donnée
// personnelle ni de message SQL). Levée par les fonctions serveur, changée
// en réponse JSON par safely().
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra?: { code?: string; fields?: FieldError[] } & Record<
      string,
      unknown
    >,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function fail(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export function ok(body: Record<string, unknown> = { ok: true }, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Corps JSON validé par le schéma, sinon erreur 400 avec le détail par champ
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Action impossible. Rechargez la page.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new ApiError(400, fields[0]?.message ?? "Certaines informations sont incorrectes.", {
      fields,
    });
  }
  return parsed.data;
}

export function parseId(value: string): string {
  if (!isUuid(value)) {
    throw new ApiError(400, "Lien incorrect. Rechargez la page.");
  }
  return value;
}

// Codes d'erreur levés par la base (contraintes et fonctions SQL)
const DB_ERRORS: Record<string, [number, string]> = {
  "42501": [403, "Accès refusé"],
  P0002: [404, "Introuvable : il a peut-être été supprimé."],
  "23505": [409, "Ce nom est déjà utilisé"],
  "55000": [409, "Campagne archivée : réactivez-la d'abord"],
  "55006": [409, "Verrouillé par le patron."],
  "2BP01": [409, "Cette campagne contient des dossiers : archivez-la plutôt"],
  "54000": [409, "Vous avez atteint le maximum autorisé."],
  // Abonnement terminé (déclencheurs de la migration subscriptions)
  "25006": [403, "Abonnement expiré : votre agence est en lecture seule."],
  "23514": [400, "Certaines informations sont incorrectes."],
  "23503": [400, "Certaines informations sont incorrectes."],
  "22023": [400, "Certaines informations sont incorrectes."],
  "22003": [400, "Montant invalide"],
  "22007": [400, "Date invalide"],
  "22008": [400, "Date invalide"],
};

// Erreur de la base → ApiError au message français. `messages` précise le
// message selon le contexte. Seul le code est écrit dans les logs.
export function dbError(
  label: string,
  error: { code?: string },
  messages: Partial<Record<string, string>> = {},
): ApiError {
  const known = error.code ? DB_ERRORS[error.code] : undefined;
  if (!known) {
    reportError(`[${label}]`, error.code ?? "erreur");
    return new ApiError(500, "Une erreur est survenue. Réessayez dans un instant.");
  }
  return new ApiError(known[0], messages[error.code!] ?? known[1]);
}

// Limite d'essais atteinte (code 54000 des fonctions de limitation :
// connexion candidat, inscription, messages du candidat) : réponse 429, le
// code HTTP prévu pour « trop de requêtes ». Les plafonds de quantité (30
// groupes, 10 comptes…) gardent le 409 de dbError.
export function rateLimited(error: { code?: string }, message: string): ApiError | null {
  return error.code === "54000" ? new ApiError(429, message) : null;
}

// Enveloppe une route : une ApiError devient sa réponse, toute autre
// exception une réponse 500, signalée au suivi des erreurs (voir
// reportException : les logs n'en gardent que le nom).
export async function safely(
  label: string,
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.message, e.status, e.extra);
    reportException(`[${label}]`, e);
    return fail("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}

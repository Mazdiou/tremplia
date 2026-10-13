import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

// Réponses sans cache : elles peuvent contenir un lien signé ou un secret.
const NO_STORE = { "Cache-Control": "no-store" };

export function fail(error: string, status: number, fields?: unknown) {
  return NextResponse.json(
    fields ? { error, fields } : { error },
    { status, headers: NO_STORE },
  );
}

export function ok(body: Record<string, unknown> = { ok: true }, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validationError(error: z.ZodError) {
  const fields = error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return fail(fields[0]?.message ?? "Données invalides", 400, fields);
}

// Enveloppe une route : toute exception devient une réponse JSON propre
// (500 « Erreur serveur »). Seul le nom de l'erreur est écrit dans les logs,
// jamais son message, qui pourrait contenir une donnée personnelle.
export async function safely(
  label: string,
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error(`[${label}]`, e instanceof Error ? e.name : "erreur");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

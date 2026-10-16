import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { signSession } from "./keys";

// Session du candidat : un cookie signé par le serveur, séparé de la
// session des employés (Supabase Auth). Revérifiée à chaque affichage :
// accès fermé, nouveau code ou dossier abandonné la rendent invalide.

export const STUDENT_COOKIE = "sf_student";
const MAX_AGE = 7 * 24 * 3600;

type Payload = { c: string; a: string; g: number; e: number };
export type StudentSession = { caseId: string; agencyId: string; generation: number };

export function sessionCookie(caseId: string, agencyId: string, generation: number) {
  const payload: Payload = {
    c: caseId,
    a: agencyId,
    g: generation,
    e: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    name: STUDENT_COOKIE,
    value: `${body}.${signSession(body)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

function readCookie(value: string | undefined): Payload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(signSession(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return p.e > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

// Candidat connecté, ou null. Mis en cache pour la durée d'un affichage.
export const getStudentSession = cache(async (): Promise<StudentSession | null> => {
  const p = readCookie((await cookies()).get(STUDENT_COOKIE)?.value);
  if (!p) return null;

  const { data, error } = await createAdminClient().rpc("student_access_open", {
    p_case_id: p.c,
    p_agency_id: p.a,
  });
  if (error) {
    console.error("[student session]", error.code);
    return null;
  }
  const row = (data as { generation: number }[] | null)?.[0];
  return row && row.generation === p.g
    ? { caseId: p.c, agencyId: p.a, generation: p.g }
    : null;
});

// Pour les routes API du candidat : refuse (401) au lieu de renvoyer null
export async function requireApiStudent(): Promise<StudentSession> {
  const session = await getStudentSession();
  if (!session) throw new ApiError(401, "Votre session a expiré : reconnectez-vous");
  return session;
}

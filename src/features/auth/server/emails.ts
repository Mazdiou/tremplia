import "server-only";
import { dbError, rateLimited } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { authLink, confirmEmailEmail, passwordResetEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/site-url";
import { reportException } from "@/lib/report-error";
import { emailHash, ipHash } from "@/features/student/server/keys";

// E-mails de connexion : confirmation de l'adresse d'une nouvelle agence et
// mot de passe oublié. Les liens viennent de Supabase Auth (jeton à usage
// unique, valable 1 heure) mais l'e-mail part par l'application (Resend),
// en français et à son adresse publique (SITE_URL), jamais celle de la
// requête.

type Account = { user_id: string; first_name: string | null; confirmed: boolean; active: boolean };

// Lien de confirmation d'une adresse pas encore confirmée. Le lien
// « magiclink » d'un compte non confirmé confirme l'adresse en l'ouvrant.
export async function sendConfirmationLink(email: string, firstName?: string | null) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const token = data?.properties?.hashed_token;
  if (error || !token) throw new Error(`generateLink ${error?.code ?? "sans jeton"}`);
  await sendEmail({
    to: email,
    ...confirmEmailEmail(authLink(siteUrl(), token, "email"), firstName ?? undefined),
  });
}

async function sendRecoveryLink(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email,
  });
  const token = data?.properties?.hashed_token;
  if (error || !token) throw new Error(`generateLink ${error?.code ?? "sans jeton"}`);
  await sendEmail({ to: email, ...passwordResetEmail(authLink(siteUrl(), token, "recovery")) });
}

// Demande venue d'une page publique : comptée (limites par adresse IP, par
// adresse e-mail et pour tout le service), puis compte cherché. Renvoie le
// compte seulement s'il faut envoyer quelque chose.
async function checkRequest(
  kind: "recovery" | "confirmation",
  email: string,
  ip: string,
): Promise<Account | null> {
  const admin = createAdminClient();
  const { data: allowed, error: limitError } = await admin.rpc("email_request_allowed", {
    p_kind: kind,
    p_ip_hash: ipHash(ip),
    p_email_hash: emailHash(email),
  });
  if (limitError) {
    throw (
      rateLimited(limitError, "Trop de demandes pour le moment. Réessayez dans une heure.") ??
      dbError("email limit", limitError)
    );
  }
  if (allowed !== true) return null;

  const { data, error } = await admin.rpc("account_for_email", { p_email: email });
  if (error) throw dbError("email account", error);
  return ((data as Account[] | null) ?? [])[0] ?? null;
}

// Mot de passe oublié. La réponse est la même que le compte existe ou non :
// rien ne dit à un inconnu quelles adresses ont un compte. Un employé
// désactivé ne reçoit rien.
export async function requestPasswordReset(email: string, ip: string) {
  const account = await checkRequest("recovery", email, ip);
  if (!account?.active) return;
  try {
    await sendRecoveryLink(email);
  } catch (e) {
    reportException("[password reset email]", e);
  }
}

// Nouvel e-mail de confirmation, demandé depuis la page de connexion ou la
// fin de l'inscription. Même réponse dans tous les cas.
export async function requestConfirmationEmail(email: string, ip: string) {
  const account = await checkRequest("confirmation", email, ip);
  if (!account || account.confirmed || !account.active) return;
  try {
    await sendConfirmationLink(email, account.first_name);
  } catch (e) {
    reportException("[confirmation email]", e);
  }
}

// Après une inscription : l'agence est créée même si l'e-mail ne part pas
// (la page propose de le renvoyer)
export async function sendWelcomeConfirmation(email: string, firstName: string) {
  try {
    await sendConfirmationLink(email, firstName);
    return true;
  } catch (e) {
    reportException("[register email]", e);
    return false;
  }
}

import "server-only";
import { after } from "next/server";
import webpush, { WebPushError } from "web-push";
import { BRAND } from "@/config/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError, reportException } from "@/lib/report-error";
import type { PushPayload } from "../texts";

// Envoi des notifications (Web Push). Les clés VAPID identifient Tremplia
// auprès des services de notification des navigateurs : la publique est
// donnée au navigateur à l'activation, la privée signe chaque envoi. Sans
// elles, rien n'est proposé ni envoyé. Création : README, « Notifications ».

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { subject: `mailto:${BRAND.email.contact}`, publicKey, privateKey };
}

// Clé publique donnée au navigateur, ou null si les notifications ne sont
// pas configurées
export function pushPublicKey() {
  return vapid()?.publicKey ?? null;
}

export function pushConfigured() {
  return vapid() !== null;
}

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };

// Raison du refus donnée par le service (Apple : {"reason":"BadJwtToken"}),
// seulement si c'est un simple mot : jamais d'autre contenu dans les logs
function refusalReason(body: unknown) {
  try {
    const reason = (JSON.parse(String(body)) as { reason?: unknown }).reason;
    return typeof reason === "string" && /^[A-Za-z]{1,40}$/.test(reason) ? reason : null;
  } catch {
    return null;
  }
}

// Une notification vers chaque appareil. Un appareil que le service ne
// connaît plus (désabonné, navigateur effacé : 404 ou 410) est retiré.
// Ne lève jamais : une notification manquée ne doit pas faire échouer
// l'action qui l'a déclenchée.
export async function sendPush(targets: PushTarget[], payload: PushPayload) {
  const details = vapid();
  if (!details || targets.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, {
        vapidDetails: details,
        // Appareil éteint : gardée un jour, puis abandonnée
        TTL: 24 * 3600,
        urgency: "high",
        timeout: 10_000,
      }),
    ),
  );

  const gone: string[] = [];
  let failed = 0;
  let firstFailure: string | null = null;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") return;
    const error = r.reason instanceof WebPushError ? r.reason : null;
    const status = error?.statusCode ?? null;
    if (status === 404 || status === 410) {
      gone.push(targets[i].id);
      return;
    }
    failed++;
    firstFailure ??= status
      ? [status, refusalReason(error?.body)].filter(Boolean).join(" ")
      : r.reason instanceof Error
        ? r.reason.name
        : "erreur";
  });

  if (gone.length > 0) {
    const { error } = await createAdminClient().from("push_subscriptions").delete().in("id", gone);
    if (error) reportError("[push cleanup]", error.code);
  }
  // Seulement un code : l'adresse de l'appareil n'est jamais écrite
  if (firstFailure) reportError("[push send]", firstFailure, `${failed}/${targets.length}`);
  return { sent: targets.length - gone.length - failed, removed: gone.length, failed };
}

// Après la réponse : l'action de l'utilisateur n'attend pas les envois
export function pushInBackground(label: string, run: () => Promise<unknown>) {
  if (!pushConfigured()) return;
  after(async () => {
    try {
      await run();
    } catch (e) {
      reportException(`[${label}]`, e);
    }
  });
}

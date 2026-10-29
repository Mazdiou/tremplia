// Notifications côté navigateur : abonnement de cet appareil auprès du
// service de notification du navigateur, par le service worker (public/sw.js).
// Chaque fonction ne lève jamais.

export type PushSupport =
  | "supported"
  // Navigateur sans notifications (ancien, ou navigation privée)
  | "unsupported"
  // iPhone ou iPad : seulement depuis l'appli installée sur l'écran d'accueil
  | "ios-install";

export function pushSupport(): PushSupport {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    ? "supported"
    : "unsupported";
}

export function notificationPermission(): NotificationPermission {
  return "Notification" in window ? Notification.permission : "denied";
}

// Abonnement actuel de cet appareil, ou null
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Clé inconnue (navigateur qui ne la donne pas) : considérée comme la même,
// pour ne jamais retirer un abonnement qui marche peut-être
function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Le service de notification du navigateur peut ne jamais répondre (réseau
// filtré, navigateur bridé) : le bouton ne doit pas tourner sans fin
const SUBSCRIBE_TIMEOUT = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export type SubscribeResult =
  | { ok: true; subscription: PushSubscriptionJSON }
  | { ok: false; error: string };

// Abonnement de cet appareil, créé s'il manque (autorisation déjà donnée).
// Le service worker est enregistré au besoin (en développement, il ne l'est
// pas d'office). replaceStale : seulement après un toucher sur « Activer »,
// car l'iPhone n'accepte de créer un abonnement qu'à ce moment-là ; la
// réparation automatique ne retire donc jamais rien.
async function ensureSubscription(publicKey: string, { replaceStale = false } = {}) {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // Clés changées sur le serveur : l'ancien abonnement ne sert plus
  if (replaceStale && subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  return (
    subscription ??
    (await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }),
      SUBSCRIBE_TIMEOUT,
    ))
  );
}

// Appareil activé par ce compte, retenu sur l'appareil (owner : membre ou
// dossier du candidat) : l'abonnement peut disparaître sans que personne
// l'ait désactivé (Safari sur iPhone le retire parfois, le navigateur peut
// le renouveler). keepPushDevice le recrée et le réenregistre alors tout
// seul.

const DEVICE_KEY = "tremplia.push-device";
// Réenregistré au plus toutes les heures quand rien n'a changé (le serveur
// peut l'avoir retiré : autre appareil déconnecté, mot de passe changé…)
const RESYNC_MS = 3600 * 1000;

type DeviceMark = { owner: string; endpoint: string; syncedAt: number };

function readMark(): DeviceMark | null {
  try {
    const mark = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null") as DeviceMark | null;
    return mark && typeof mark.owner === "string" ? mark : null;
  } catch {
    return null;
  }
}

export function rememberPushDevice(owner: string, endpoint: string, syncedAt = Date.now()) {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ owner, endpoint, syncedAt }));
  } catch {
    // Stockage indisponible : pas de réparation automatique, rien de plus
  }
}

// À réenregistrer dès la prochaine ouverture (après une déconnexion)
function markNeedsSync() {
  const mark = readMark();
  if (mark) rememberPushDevice(mark.owner, mark.endpoint, 0);
}

function forgetMark() {
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Rien à faire
  }
}

// Une réparation à la fois : la suivante attend la précédente (deux
// abonnements créés en même temps se remplaceraient)
let queue: Promise<void> = Promise.resolve();
// Augmenté à chaque déconnexion : une réparation commencée avant ne marque
// pas l'appareil « à jour » (il doit être réenregistré à la reconnexion)
let pauses = 0;

// Attendre la réparation en cours, 5 secondes au plus : une déconnexion ne
// doit jamais rester bloquée
function settled() {
  return Promise.race([queue, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
}

// Si cet appareil a été activé par ce compte : abonnement recréé s'il a
// disparu, et réenregistré sur le serveur (deviceUrl, POST) s'il a changé
// ou de temps en temps (force : tout de suite, page Réglages). Sans effet
// sinon, et ne lève jamais.
export function keepPushDevice(opts: {
  publicKey: string;
  deviceUrl: string;
  owner: string;
  force?: boolean;
}) {
  queue = queue.then(() => keep(opts)).catch(() => {
    // Hors connexion, service indisponible : nouvel essai plus tard
  });
  return queue;
}

async function keep(opts: { publicKey: string; deviceUrl: string; owner: string; force?: boolean }) {
  const started = pauses;
  const mark = readMark();
  if (!mark || mark.owner !== opts.owner) return;
  if (pushSupport() !== "supported") return;
  // Autorisation retirée dans les réglages du téléphone : plus rien à garder
  if (notificationPermission() !== "granted") return forgetMark();
  const subscription = (await ensureSubscription(opts.publicKey)).toJSON();
  if (!subscription.endpoint) return;
  const recent = Date.now() - mark.syncedAt < RESYNC_MS;
  if (!opts.force && subscription.endpoint === mark.endpoint && recent) return;
  const res = await fetch(opts.deviceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (res.ok && pauses === started) rememberPushDevice(opts.owner, subscription.endpoint);
}

// Demande l'autorisation puis abonne cet appareil. Le service worker est
// enregistré au besoin (en développement, il ne l'est pas d'office).
export async function subscribePush(publicKey: string): Promise<SubscribeResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        error:
          permission === "denied"
            ? "Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur, puis réessayez."
            : "Autorisation non donnée : réessayez et choisissez « Autoriser ».",
      };
    }
    const subscription = await ensureSubscription(publicKey, { replaceStale: true });
    return { ok: true, subscription: subscription.toJSON() };
  } catch {
    return {
      ok: false,
      error:
        "Les notifications n'ont pas pu être activées. Réessayez, ou essayez un autre navigateur.",
    };
  }
}

async function deleteOnServer(url: string, endpoint: string | null) {
  try {
    await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
      keepalive: true,
    });
  } catch {
    // Hors connexion : l'appareil sera retiré au premier envoi refusé
  }
}

// À la déconnexion : le serveur oublie cet appareil (tant que la session est
// encore ouverte), plus rien n'arrive. L'appareil reste retenu pour ce
// compte : à sa prochaine connexion ici, les notifications reviennent toutes
// seules (un autre compte, lui, ne les reçoit jamais sans les activer).
export async function pausePushDevice(url: string) {
  pauses++;
  // Une réparation en cours (page Réglages ouverte à l'instant) le
  // réenregistrerait juste après : elle se termine d'abord
  await settled();
  const subscription = await currentPushSubscription();
  if (subscription) await deleteOnServer(url, subscription.endpoint);
  markNeedsSync();
}

// « Désactiver » : oublié sur le serveur et sur l'appareil, abonnement retiré
export async function forgetPushDevice(url: string) {
  await settled();
  forgetMark();
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await deleteOnServer(url, subscription.endpoint);
  await subscription.unsubscribe().catch(() => false);
}

// Après « déconnecter les autres appareils » (keepThisDevice) ou à la
// déconnexion de toutes les sessions : les appareils concernés ne reçoivent
// plus les notifications du membre (chacun les retrouve à sa reconnexion)
export async function forgetOtherPushDevices({ keepThisDevice }: { keepThisDevice: boolean }) {
  if (!keepThisDevice) pauses++;
  await settled();
  const subscription = await currentPushSubscription();
  await deleteOnServer(
    "/api/push/device/others",
    keepThisDevice ? (subscription?.endpoint ?? null) : null,
  );
  if (!keepThisDevice) markNeedsSync();
}

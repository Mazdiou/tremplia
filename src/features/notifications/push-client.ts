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

function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
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
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    // Clés changées sur le serveur : l'ancien abonnement ne sert plus
    if (subscription && !sameKey(subscription, publicKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }),
      SUBSCRIBE_TIMEOUT,
    );
    return { ok: true, subscription: subscription.toJSON() };
  } catch {
    return {
      ok: false,
      error:
        "Ce navigateur n'a pas pu activer les notifications. Réessayez dans un moment ; si cela continue, essayez un autre navigateur.",
    };
  }
}

// À la déconnexion : le serveur oublie cet appareil (tant que la session
// est encore ouverte), puis l'abonnement du navigateur est retiré. `url` :
// route DELETE qui reçoit { endpoint } (null : l'appareil n'est pas abonné).
export async function forgetPushDevice(url: string) {
  const subscription = await currentPushSubscription();
  if (!subscription) return null;
  try {
    await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      keepalive: true,
    });
  } catch {
    // Hors connexion : l'appareil sera retiré au premier envoi refusé
  }
  await subscription.unsubscribe().catch(() => false);
  return subscription.endpoint;
}

// Après « déconnecter les autres appareils » (keepThisDevice) ou à la
// déconnexion de tous : les appareils concernés ne reçoivent plus les
// notifications du membre
export async function forgetOtherPushDevices({ keepThisDevice }: { keepThisDevice: boolean }) {
  const subscription = await currentPushSubscription();
  try {
    await fetch("/api/push/device/others", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: keepThisDevice ? (subscription?.endpoint ?? null) : null }),
      keepalive: true,
    });
  } catch {
    // Hors connexion : rien de plus à faire ici
  }
  if (!keepThisDevice) await subscription?.unsubscribe().catch(() => false);
}

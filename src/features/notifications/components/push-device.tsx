"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { callApi } from "@/lib/api-client";
import {
  currentPushSubscription,
  forgetPushDevice,
  keepPushDevice,
  notificationPermission,
  pushSupport,
  rememberPushDevice,
  subscribePush,
} from "../push-client";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

// Activer ou désactiver les notifications sur cet appareil (téléphone,
// ordinateur) : membre dans Réglages, candidat dans ses messages. Chaque
// appareil s'active à part.
export function PushDevice({
  publicKey,
  deviceUrl,
  testUrl,
  activateLabel = "Activer sur cet appareil",
  onLabel = "Activées sur cet appareil.",
  offLabel = "Pas encore activées sur cet appareil.",
  appName,
  owner,
}: {
  // null : notifications pas encore configurées sur le serveur
  publicKey: string | null;
  // POST : activer ; DELETE : désactiver ; <deviceUrl>/status : état
  deviceUrl: string;
  // Notification d'essai (membres seulement)
  testUrl?: string;
  activateLabel?: string;
  onLabel?: string;
  offLabel?: string;
  // Nom de l'icône sur l'écran d'accueil (iPhone)
  appName: string;
  // Compte qui active cet appareil (membre, ou dossier du candidat)
  owner: string;
}) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    void (async () => {
      const support = pushSupport();
      let next: State;
      if (support !== "supported") next = support;
      else if (notificationPermission() === "denied") next = "denied";
      else {
        // Abonnement disparu tout seul (iPhone, ou retiré par le serveur) :
        // recréé et réenregistré avant de lire l'état
        await keepPushDevice({ publicKey, deviceUrl, owner, force: true });
        const subscription = await currentPushSubscription();
        if (!subscription) next = "off";
        else {
          // Abonné dans le navigateur, mais peut-être pour un autre compte
          const res = await callApi<{ registered: boolean }>(`${deviceUrl}/status`, {
            body: { endpoint: subscription.endpoint },
          });
          next = res.ok && res.data.registered ? "on" : "off";
          // Activé avant que l'appareil soit retenu : il l'est désormais
          if (next === "on") rememberPushDevice(owner, subscription.endpoint);
        }
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, deviceUrl, owner]);

  if (!publicKey) {
    return <Notice>Les notifications ne sont pas encore disponibles.</Notice>;
  }
  if (state === "loading") {
    return <p className="min-h-10 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (state === "unsupported") {
    return (
      <Notice>
        Ce navigateur ne permet pas les notifications (ou la navigation privée les bloque).
        Essayez Chrome, Edge, Firefox ou Safari à jour.
      </Notice>
    );
  }
  if (state === "ios-install") {
    return (
      <Notice>
        Sur iPhone et iPad, les notifications arrivent seulement dans l&apos;appli installée :
        dans Safari, touchez Partager puis «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;», ouvrez {appName}{" "}
        depuis cette icône, et revenez ici.
      </Notice>
    );
  }
  if (state === "denied") {
    return (
      <Notice>
        Les notifications sont bloquées pour {appName} dans ce navigateur. Autorisez-les dans
        les réglages du site (sur ordinateur, l&apos;icône à gauche de l&apos;adresse), puis
        rechargez la page.
      </Notice>
    );
  }

  async function activate() {
    setBusy(true);
    setMessage(null);
    const result = await subscribePush(publicKey!);
    if (!result.ok) {
      setBusy(false);
      if (notificationPermission() === "denied") setState("denied");
      return setMessage({ text: result.error, error: true });
    }
    const res = await callApi(deviceUrl, { body: result.subscription });
    setBusy(false);
    if (!res.ok) return setMessage({ text: res.error, error: true });
    if (result.subscription.endpoint) rememberPushDevice(owner, result.subscription.endpoint);
    setState("on");
    setMessage({ text: "Notifications activées.", error: false });
  }

  async function deactivate() {
    setBusy(true);
    setMessage(null);
    await forgetPushDevice(deviceUrl);
    setBusy(false);
    setState("off");
    setMessage({ text: "Notifications désactivées sur cet appareil.", error: false });
  }

  async function test() {
    const subscription = await currentPushSubscription();
    if (!subscription || !testUrl) return setState("off");
    setBusy(true);
    setMessage(null);
    const res = await callApi(testUrl, { body: { endpoint: subscription.endpoint } });
    setBusy(false);
    if (!res.ok) {
      // Appareil plus reconnu par le serveur ou le navigateur : à réactiver
      if (res.data?.reactivate === true) setState("off");
      return setMessage({ text: res.error, error: true });
    }
    setMessage({ text: "Essai envoyé : la notification arrive dans quelques secondes.", error: false });
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        {state === "on" ? (
          <BellRing className="size-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <BellOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className={state === "on" ? "font-medium" : "text-muted-foreground"}>
          {state === "on" ? onLabel : offLabel}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <Button onClick={() => void activate()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
            {activateLabel}
          </Button>
        ) : (
          <>
            {testUrl && (
              <Button variant="outline" onClick={() => void test()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                Envoyer un essai
              </Button>
            )}
            <Button variant="ghost" onClick={() => void deactivate()} disabled={busy}>
              <BellOff aria-hidden />
              Désactiver
            </Button>
          </>
        )}
      </div>
      <StatusMessage message={message} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{children}</p>;
}

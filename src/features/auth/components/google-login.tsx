"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FormError } from "@/components/auth/auth-field";
import { useIsDark } from "@/components/theme-toggle";
import { GOOGLE_CLIENT_ID, NO_ACCOUNT, createNonce, googleSignInError } from "../google";

// Partie utilisée de Google Identity Services
type GoogleId = {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    context: "signin";
    ux_mode: "popup";
    itp_support: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

// Script de Google chargé une seule fois, et seulement sur cette page
function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) resolve(window.google.accounts.id);
      else reject(new Error("Google Identity Services absent"));
    };
    script.onerror = () => {
      // Bloqué (extension, réseau) : un prochain affichage réessaiera
      loading = null;
      script.remove();
      reject(new Error("Google Identity Services bloqué"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// « Continuer avec Google » sous le formulaire de connexion. Rien sans
// identifiant Google, ni quand le script de Google ne peut pas se charger :
// le mot de passe reste toujours possible.
export function GoogleLogin() {
  return GOOGLE_CLIENT_ID ? <GoogleButton clientId={GOOGLE_CLIENT_ID} /> : null;
}

function GoogleButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const nonce = useRef("");
  const [gsi, setGsi] = useState<GoogleId | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Nouveau nonce après chaque essai refusé
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dark = useIsDark();

  function fail(message: string) {
    setBusy(false);
    setError(message);
    setAttempt((n) => n + 1);
  }

  // Jeton reçu de Google : Supabase ouvre la session du compte qui a cette
  // adresse (le compte Google lui est rattaché à la première fois)
  const onCredential = useEffectEvent(async (credential: string) => {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: credential,
      nonce: nonce.current,
    });
    if (error) return fail(googleSignInError(error));

    // Session ouverte mais aucun profil lisible : compte sans agence
    // (inscriptions ouvertes par erreur dans Supabase) ou désactivé
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profileError && !profile) {
      await supabase.auth.signOut({ scope: "local" });
      return fail(NO_ACCOUNT);
    }

    // Mot de passe temporaire d'un employé : le proxy l'envoie le changer
    router.replace("/dashboard");
    router.refresh();
  });

  useEffect(() => {
    loadGoogle().then(setGsi, () => setUnavailable(true));
  }, []);

  useEffect(() => {
    if (!gsi) return;
    let cancelled = false;
    void createNonce().then(({ raw, hashed }) => {
      if (cancelled) return;
      nonce.current = raw;
      gsi.initialize({
        client_id: clientId,
        callback: ({ credential }) => void onCredential(credential),
        nonce: hashed,
        context: "signin",
        ux_mode: "popup",
        itp_support: true,
      });
      setReady((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [gsi, clientId, attempt]);

  // Bouton dessiné par Google, aux couleurs du thème et à la largeur du
  // formulaire (Google accepte de 200 à 400 px)
  useEffect(() => {
    const el = holder.current;
    if (!gsi || !ready || !el) return;
    gsi.renderButton(el, {
      type: "standard",
      theme: dark ? "filled_black" : "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: Math.min(400, Math.max(200, Math.floor(el.clientWidth))),
      locale: "fr",
    });
  }, [gsi, ready, dark]);

  if (unavailable) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <FormError message={error} />
      {/* Hauteur du bouton réservée pendant le chargement du script */}
      <div ref={holder} className="flex h-10 justify-center [color-scheme:normal]" />
      {busy && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Connexion avec Google…
        </p>
      )}
    </div>
  );
}

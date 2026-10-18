"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";

// Invitation à installer l'application sur le téléphone (écran d'accueil,
// plein écran). Masquée sur ordinateur, dans l'appli déjà installée, et
// pour de bon dès qu'on la ferme.
// - Android (Chrome, Edge, Samsung…) : bouton « Installer » (fenêtre du système)
// - iPhone / iPad (Safari) : pas de bouton possible, les deux gestes à faire

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    // Gardé par le script du layout racine, l'événement pouvant arriver
    // avant l'affichage de ce composant
    __installPrompt?: InstallPrompt | null;
  }
}

const DISMISSED_KEY = "sf:install-dismissed";

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Chrome, Firefox… sur iPhone : le menu diffère, Safari reste la référence
  return ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function InstallAppCard({ appName }: { appName: string }) {
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Stockage indisponible : la carte s'affiche, sans mémoire
    }
    if (isInstalled()) return;

    const show = () => setMode(window.__installPrompt ? "prompt" : isIosSafari() ? "ios" : null);
    const hide = () => setMode(null);
    show();
    window.addEventListener("sf:installable", show);
    window.addEventListener("appinstalled", hide);
    return () => {
      window.removeEventListener("sf:installable", show);
      window.removeEventListener("appinstalled", hide);
    };
  }, []);

  function dismiss() {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Stockage indisponible : la carte reviendra à la prochaine visite
    }
  }

  async function install() {
    const prompt = window.__installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // Une fenêtre d'installation ne sert qu'une fois
    window.__installPrompt = null;
    if (outcome === "accepted") setMode(null);
  }

  if (!mode) return null;

  return (
    <aside
      aria-label="Installer l'application"
      className="relative flex items-start gap-3 rounded-2xl border bg-card p-4 pr-11 shadow-sm md:hidden"
    >
      <LogoMark className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Installez {appName} sur votre téléphone</p>
        {mode === "prompt" ? (
          <>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ouvrez-la d&apos;un geste depuis l&apos;écran d&apos;accueil, en plein écran.
            </p>
            <Button className="mt-3 h-11 w-full" onClick={install}>
              Installer l&apos;application
            </Button>
          </>
        ) : (
          // Icônes dans le fil du texte : la phrase se coupe proprement
          <ol className="mt-1.5 space-y-1 text-sm text-muted-foreground [&_svg]:mx-0.5 [&_svg]:inline [&_svg]:size-4 [&_svg]:-translate-y-px [&_svg]:text-primary">
            <li>
              1. Dans Safari, touchez <span className="font-medium text-foreground">Partager</span>{" "}
              <Share aria-hidden />
            </li>
            <li>
              2. Choisissez <SquarePlus aria-hidden />{" "}
              <span className="font-medium text-foreground">« Sur l&apos;écran d&apos;accueil »</span>
            </li>
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ne plus proposer"
        title="Ne plus proposer"
        className="absolute top-2 right-2 grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}

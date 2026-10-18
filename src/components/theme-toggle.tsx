"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fondu en cours : les appuis suivants sont ignorés (sur téléphone, un double
// appui remettait aussitôt l'ancien thème)
let busy = false;

// Passe au thème clair ou sombre et retient le choix
export function setTheme(dark: boolean) {
  const root = document.documentElement;
  if (busy || root.classList.contains("dark") === dark) return;

  // Sans animation pendant le changement : les éléments animés au survol
  // (cartes, boutons) changeraient de couleur en retard sur le reste.
  const apply = () => {
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
    root.classList.toggle("dark", dark);
    // Force le calcul des nouveaux styles avant de rendre les animations
    void getComputedStyle(document.body).color;
    setTimeout(() => freeze.remove(), 1);
  };

  // Fondu léger de toute la page (globals.css), si le navigateur le permet.
  // Gardé même quand l'utilisateur réduit les animations : un fondu ne
  // déplace rien à l'écran.
  if (document.startViewTransition) {
    busy = true;
    document
      .startViewTransition(apply)
      .finished.finally(() => {
        busy = false;
      });
  } else {
    apply();
  }

  try {
    localStorage.setItem("sf:theme", dark ? "dark" : "light");
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement
  }
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

// Thème sombre actif ? null au rendu serveur et à l'hydratation
export function useIsDark() {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => null,
  );
}

// Les deux icônes sont dans le HTML ; le CSS (classe .dark posée avant
// l'hydratation par le script du layout) choisit laquelle s'affiche.
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(!document.documentElement.classList.contains("dark"))}
      className={cn("touch-manipulation", className)}
      aria-label="Changer de thème"
      title="Changer de thème"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

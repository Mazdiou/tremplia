"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Les deux icônes sont dans le HTML ; le CSS (classe .dark posée avant
// l'hydratation par le script du layout) choisit laquelle s'affiche.
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");

    // Sans animation pendant le changement : les éléments animés au survol
    // (cartes, boutons) changeraient de couleur en retard sur le reste.
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
    root.classList.toggle("dark", dark);
    // Force le calcul des nouveaux styles avant de rendre les animations
    void getComputedStyle(document.body).color;
    setTimeout(() => freeze.remove(), 1);

    try {
      localStorage.setItem("sf:theme", dark ? "dark" : "light");
    } catch {
      // ignoré
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className={className}
      aria-label="Changer de thème"
      title="Changer de thème"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

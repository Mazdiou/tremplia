"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useIsDark } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { dark: false, label: "Clair", icon: Sun },
  { dark: true, label: "Sombre", icon: Moon },
];

// Thème clair ou sombre. Sur téléphone, c'est ici qu'il se change (la barre
// du bas n'a pas de bouton de thème).
export function ThemeChoice() {
  const isDark = useIsDark();

  return (
    <div role="radiogroup" aria-label="Thème" className="inline-flex rounded-xl border bg-muted/50 p-1">
      {OPTIONS.map(({ dark, label, icon: Icon }) => {
        const checked = isDark === dark;
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(dark)}
            className={cn(
              "flex h-10 touch-manipulation items-center gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors",
              checked && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

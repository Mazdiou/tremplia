"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Sur téléphone, l'arbre et le contenu s'affichent chacun leur tour : sur
// l'accueil des dossiers, seul l'arbre est visible ; ailleurs (fiche,
// nouveau dossier…), seul le contenu.
export function isCasesIndex(pathname: string | null) {
  return pathname === "/cases";
}

export function CasesContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      className={cn(
        "min-w-0 flex-1 overflow-y-auto",
        isCasesIndex(pathname) && "max-md:hidden",
      )}
    >
      {children}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Sur mobile, l'arbre et la fiche s'affichent chacun leur tour :
// sans dossier sélectionné, seul l'arbre est visible.
export function CasesContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  return (
    <div
      className={cn(
        "min-w-0 flex-1 overflow-y-auto",
        !params?.id && "max-md:hidden",
      )}
    >
      {children}
    </div>
  );
}

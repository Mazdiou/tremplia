import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "agency", href: "/login", label: "Agence", icon: Building2 },
  { key: "student", href: "/student/login", label: "Candidat", icon: UserRound },
] as const;

// Choix de l'espace sur la page de connexion : l'agence (e-mail et mot de
// passe) ou le candidat (code d'accès). Deux pages, même présentation.
export function LoginSwitch({ active }: { active: "agency" | "student" }) {
  return (
    <nav aria-label="Type de connexion" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          replace
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
            t.key === active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <t.icon className="size-4" aria-hidden />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

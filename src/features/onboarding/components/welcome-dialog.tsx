"use client";

import { useState } from "react";
import { FolderOpen, ListTodo, MessagesSquare, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo-mark";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { callApi } from "@/lib/api-client";
import { BRAND } from "@/config/brand";
import { plural } from "@/lib/plural";

const OWNER_POINTS = [
  {
    icon: FolderOpen,
    text: "Les dossiers, documents et paiements de vos candidats, au même endroit",
  },
  { icon: ListTodo, text: "Des tâches et des relances qui ne s'oublient pas" },
  {
    icon: UserRound,
    text: "Un espace pour chaque candidat, pour suivre son dossier",
  },
];
const EMPLOYEE_POINTS = [
  { icon: FolderOpen, text: "Les dossiers de l'agence, dans « Dossiers »" },
  { icon: ListTodo, text: "Ce qu'on vous a confié, dans « Tâches »" },
  {
    icon: MessagesSquare,
    text: "Les messages des candidats, dans chaque dossier",
  },
];

// Mot de bienvenue, une seule fois par membre (première connexion). Fermé,
// il est noté comme vu ; un échec d'enregistrement le fera simplement revenir.
export function WelcomeDialog({
  firstName,
  isOwner,
  trialDays,
}: {
  firstName: string;
  isOwner: boolean;
  // Essai en cours : jours restants
  trialDays: number | null;
}) {
  const [open, setOpen] = useState(true);
  const ref = useModalDialog(open);

  function close() {
    if (!open) return;
    setOpen(false);
    void callApi("/api/onboarding/welcome");
  }

  const points = isOwner ? OWNER_POINTS : EMPLOYEE_POINTS;

  return (
    <dialog
      ref={ref}
      aria-labelledby="welcome-title"
      onClose={close}
      className="m-auto w-[min(28rem,calc(100%-2rem))] overflow-hidden rounded-3xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="relative bg-highlight px-6 pt-7 pb-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-primary/15 blur-3xl"
        />
        <LogoMark className="size-11 rounded-2xl" />
        <h2
          id="welcome-title"
          className="mt-4 font-brand text-xl leading-tight font-semibold tracking-tight text-balance"
        >
          Bienvenue sur {BRAND.name}, {firstName}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isOwner
            ? "Votre agence est prête. Voici ce que vous allez pouvoir faire."
            : "Votre agence vous a ajouté à son équipe. Voici où trouver l'essentiel."}
        </p>
      </div>

      <ul className="space-y-3.5 px-6 py-5">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="pt-1.5">{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-muted-foreground">
          {isOwner
            ? trialDays !== null
              ? `Essai gratuit : encore ${plural(trialDays, "jour")}. Le guide du tableau de bord vous accompagne.`
              : "Le guide du tableau de bord vous accompagne pas à pas."
            : "Bon travail."}
        </p>
        <Button autoFocus onClick={close} className="max-sm:w-full">
          C&apos;est parti
        </Button>
      </div>
    </dialog>
  );
}

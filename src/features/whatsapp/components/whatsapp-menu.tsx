"use client";

import { useRef, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_LABELS,
  availableTemplates,
  toWhatsAppNumber,
  whatsAppMessage,
  whatsAppUrl,
  type WhatsAppContext,
} from "../whatsapp";
import { useDismiss } from "@/hooks/use-dismiss";
import { useBrowserValue } from "@/hooks/use-browser-value";
import { MENU_ITEM_CLASS } from "@/components/page-ui";

export type WhatsAppMenuContext = Omit<WhatsAppContext, "studentLink">;

// Lien de connexion de l'espace candidat, sur l'adresse du site ouvert.
// Inconnue côté serveur : le lien complet n'existe qu'une fois la page
// chargée dans le navigateur (avant, le bouton ouvre la conversation seule).
function useStudentLink(): string | null {
  return useBrowserValue(() => `${window.location.origin}/student/login`);
}

// Bouton « WhatsApp ▾ » : ouvre la conversation avec un message déjà écrit,
// que l'employé peut encore modifier dans WhatsApp avant de l'envoyer.
export function WhatsAppMenu({
  phone,
  recipient,
  context,
  align = "start",
}: {
  phone: string | null;
  // « Yacine Benali », « Karim Benali » : pour les lecteurs d'écran
  recipient: string;
  context: WhatsAppMenuContext;
  // Bord du bouton auquel le menu s'aligne : "end" pour un bouton près du
  // bord droit (le menu s'ouvre alors vers la gauche). Téléphone : en bas
  // de l'écran, sur toute sa largeur, dans les deux cas.
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const number = toWhatsAppNumber(phone);
  const studentLink = useStudentLink();

  useDismiss(ref, open, setOpen);

  if (!number) {
    const reason = "Numéro non reconnu : corrigez-le dans « Modifier »";
    return (
      <Button variant="ghost" size="xs" disabled title={reason} aria-label={`WhatsApp : ${reason}`}>
        <MessageCircle /> WhatsApp
      </Button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="xs"
        aria-label={`Écrire à ${recipient} sur WhatsApp`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-emerald-700 dark:text-emerald-400"
      >
        <MessageCircle /> WhatsApp <ChevronDown />
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-8 z-30 w-72 rounded-xl border bg-popover p-1 shadow-lg",
            // Téléphone : en bas de l'écran, au-dessus de la barre de
            // navigation, où que soit le bouton (même après défilement)
            "max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:right-4 max-sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-sm:left-4 max-sm:w-auto",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {availableTemplates(context).map((t) => (
            <a
              key={t}
              role="menuitem"
              // Lien complet dès l'affichage : il marche aussi au clic molette
              // et avec « Copier le lien »
              href={whatsAppUrl(number, whatsAppMessage(t, { ...context, studentLink: studentLink ?? "" }))}
              target="_blank"
              rel="noopener noreferrer"
              className={MENU_ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              {TEMPLATE_LABELS[t]}
              {t === "payment" && context.remaining ? (
                <span className="text-muted-foreground">
                  {" "}
                  (reste {formatDA(context.remaining)})
                </span>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Entrée « Envoyer par WhatsApp » du menu Partager de l'espace candidat :
// envoie le code d'accès
export function WhatsAppAccessItem({
  phone,
  context,
  onSelect,
}: {
  phone: string | null;
  context: WhatsAppMenuContext;
  onSelect: () => void;
}) {
  const number = toWhatsAppNumber(phone);
  const studentLink = useStudentLink();
  if (!number) return null;
  return (
    <a
      role="menuitem"
      href={
        studentLink
          ? whatsAppUrl(number, whatsAppMessage("access", { ...context, studentLink }))
          : whatsAppUrl(number)
      }
      target="_blank"
      rel="noopener noreferrer"
      onClick={onSelect}
      className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
    >
      <MessageCircle className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
      Envoyer par WhatsApp
    </a>
  );
}

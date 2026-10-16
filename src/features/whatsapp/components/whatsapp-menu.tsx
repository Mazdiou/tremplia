"use client";

import { useRef, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
}: {
  phone: string | null;
  // « Yacine Benali », « Karim Benali » : pour les lecteurs d'écran
  recipient: string;
  context: WhatsAppMenuContext;
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
          className="absolute top-8 left-0 z-30 w-72 max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:mt-1 max-sm:w-auto rounded-xl border bg-popover p-1 shadow-lg"
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

// Bouton « WhatsApp » de la barre Espace candidat : envoie le code d'accès
export function WhatsAppAccessButton({
  phone,
  context,
}: {
  phone: string | null;
  context: WhatsAppMenuContext;
}) {
  const number = toWhatsAppNumber(phone);
  const studentLink = useStudentLink();
  if (!number) return null;
  return (
    <a
      href={
        studentLink
          ? whatsAppUrl(number, whatsAppMessage("access", { ...context, studentLink }))
          : whatsAppUrl(number)
      }
      target="_blank"
      rel="noopener noreferrer"
      title="Envoyer le code au candidat par WhatsApp"
      aria-label="Envoyer le code au candidat par WhatsApp"
      className={cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "text-emerald-700 dark:text-emerald-400",
      )}
    >
      <MessageCircle aria-hidden /> WhatsApp
    </a>
  );
}

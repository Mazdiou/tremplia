"use client";

import { useEffect, useRef, useState } from "react";
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

export type WhatsAppMenuContext = Omit<WhatsAppContext, "studentLink">;

// Lien de connexion de l'espace candidat, sur l'adresse du site ouvert
function studentLink() {
  return `${window.location.origin}/student/login`;
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

  // Fermeture au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!number) {
    const reason = "Numéro non reconnu : corrigez-le dans « Modifier »";
    return (
      <Button variant="ghost" size="xs" disabled title={reason} aria-label={`WhatsApp : ${reason}`}>
        <MessageCircle /> WhatsApp
      </Button>
    );
  }

  const item =
    "block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

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
              href={`https://wa.me/${number}`}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
              // Le lien complet est construit au clic : il dépend de l'adresse
              // du site, connue seulement dans le navigateur
              onClick={(e) => {
                e.currentTarget.href = whatsAppUrl(
                  number,
                  whatsAppMessage(t, { ...context, studentLink: studentLink() }),
                );
                setOpen(false);
              }}
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

// Bouton direct « Envoyer par WhatsApp » (code d'accès au candidat)
export function WhatsAppAccessButton({
  phone,
  context,
}: {
  phone: string | null;
  context: WhatsAppMenuContext;
}) {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Envoyer le code au candidat par WhatsApp"
      aria-label="Envoyer le code au candidat par WhatsApp"
      onClick={(e) => {
        e.currentTarget.href = whatsAppUrl(
          number,
          whatsAppMessage("access", { ...context, studentLink: studentLink() }),
        );
      }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "text-emerald-700 dark:text-emerald-400",
      )}
    >
      <MessageCircle aria-hidden /> WhatsApp
    </a>
  );
}

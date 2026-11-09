"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { whatsAppUrl } from "@/features/whatsapp/whatsapp";

// Adresse de la page d'inscription en ligne, à partager : copier, envoyer
// sur WhatsApp (contact ou groupe choisi dans WhatsApp), ouvrir
export function SignupLink({ url, agencyName }: { url: string; agencyName: string }) {
  const [copied, setCopied] = useState(false);
  const share = whatsAppUrl(
    "",
    `Inscrivez-vous en ligne chez ${agencyName} pour vos études à l'étranger : ${url}`,
  );

  return (
    <div className="space-y-3">
      <p className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm break-all select-all">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // copie impossible : l'adresse reste affichée et sélectionnable
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Adresse copiée" : "Copier l'adresse"}
        </Button>
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <MessageCircle /> Partager sur WhatsApp
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLink /> Ouvrir la page
        </a>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Copie d'un mot de passe temporaire, montré une seule fois au patron
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // copie impossible : le mot de passe reste affiché
        }
      }}
    >
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

// Nouvel e-mail de confirmation de l'adresse (connexion refusée, fin de
// l'inscription). La réponse ne dit jamais si le compte existe.
export function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setError(null);
    setState("sending");
    const res = await callApi("/api/auth/confirmation", { body: { email } });
    if (!res.ok) {
      setState("idle");
      return setError(res.error);
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Nouvel e-mail envoyé. Pensez à regarder dans les courriers indésirables.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state === "sending"}
        onClick={resend}
      >
        {state === "sending" && <LoaderCircle className="animate-spin" />}
        Renvoyer l&apos;e-mail de confirmation
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

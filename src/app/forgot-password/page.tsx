"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField, FormError } from "@/components/auth/auth-field";
import { callApi } from "@/lib/api-client";

// Mot de passe oublié : un lien pour en choisir un nouveau est envoyé par
// e-mail. La réponse est la même que l'adresse ait un compte ou non.
export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get("email")).trim().toLowerCase();
    const res = await callApi("/api/auth/forgot-password", { body: { email } });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-bg text-success">
            <MailCheck className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Vérifiez votre boîte mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si un compte existe pour <span className="font-medium text-foreground">{sentTo}</span>,
            un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe. Le lien
            est valable 1 heure.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Rien reçu ? Regardez dans les courriers indésirables.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
          >
            <ArrowLeft className="size-4" />
            Retour à la connexion
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link
        href="/login"
        className="touch-target mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à la connexion
      </Link>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Indiquez l&apos;adresse e-mail de votre compte : nous vous envoyons un lien pour
          choisir un nouveau mot de passe.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <FormError message={error} />
        <AuthField
          label="Adresse e-mail"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder="vous@agence.com"
          maxLength={254}
          required
          autoFocus
        />
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Envoi…" : "Recevoir le lien"}
        </Button>
      </form>
    </AuthShell>
  );
}

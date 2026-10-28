"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginSwitch } from "@/components/auth/login-switch";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { GoogleLogin } from "@/features/auth/components/google-login";
import {
  AuthField,
  FormError,
  PasswordField,
} from "@/components/auth/auth-field";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Adresse pas encore confirmée : la connexion est refusée par Supabase
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(form.get("password")),
    });

    if (error) {
      setLoading(false);
      if (error.code === "email_not_confirmed") return setUnconfirmed(email);
      if (error.status === 429) {
        return setError("Trop d'essais. Réessayez dans quelques minutes.");
      }
      return setError("E-mail ou mot de passe incorrect.");
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <LoginSwitch active="agency" />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bon retour parmi nous
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Connectez-vous pour retrouver les dossiers de votre agence.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <FormError message={error} />
        {unconfirmed && (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-100 px-3 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            <p>
              Confirmez d&apos;abord votre adresse e-mail : cliquez sur le lien reçu à
              l&apos;inscription (pensez aux courriers indésirables).
            </p>
            <ResendConfirmation email={unconfirmed} />
          </div>
        )}

        <AuthField
          label="Adresse e-mail"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder="vous@agence.com"
          required
          autoFocus
        />
        <div className="space-y-2">
          <PasswordField
            label="Mot de passe"
            name="password"
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            required
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="touch-target text-sm font-medium text-link hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" />
              Connexion…
            </>
          ) : (
            <>
              Se connecter
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <GoogleLogin />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Nouvelle agence ?{" "}
        <Link
          href="/register"
          className="font-medium text-link hover:underline"
        >
          Démarrer l&apos;essai gratuit
        </Link>
      </p>
    </AuthShell>
  );
}

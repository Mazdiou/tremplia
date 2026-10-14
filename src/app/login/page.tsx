"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginSwitch } from "@/components/auth/login-switch";
import {
  AuthField,
  FormError,
  PasswordField,
} from "@/components/auth/auth-field";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });

    if (error) {
      setLoading(false);
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
          Connectez-vous pour retrouver vos dossiers.
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
          required
          autoFocus
        />
        <PasswordField
          label="Mot de passe"
          name="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          required
        />

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" />
              Connexion...
            </>
          ) : (
            <>
              Se connecter
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Inscrire mon agence
        </Link>
      </p>
    </AuthShell>
  );
}

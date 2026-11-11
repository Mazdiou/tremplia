"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError, PasswordField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  newPasswordErrors,
} from "@/features/auth/schemas";

// Après « Mot de passe oublié » : le lien reçu a ouvert une session, le
// nouveau mot de passe est choisi ici, sans l'ancien.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Erreur affichée sous le champ concerné
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));

    const local = newPasswordErrors(password, confirm);
    setFieldErrors(local);
    if (local.password || local.confirm) {
      (formEl.elements.namedItem(local.password ? "password" : "confirm") as HTMLInputElement | null)?.focus();
      return;
    }

    setLoading(true);
    // Le changement ferme les sessions du compte : on se reconnecte aussitôt
    // avec le nouveau mot de passe (comme /change-password)
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    const res = await callApi("/api/auth/reset-password", { body: { password } });
    if (!res.ok) {
      setLoading(false);
      setExpired(res.error.startsWith("Lien expiré"));
      return setError(res.error);
    }
    if (email) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginError) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <FormError message={error} />
        {expired && (
          <Link
            href="/forgot-password"
            className="block text-sm font-medium text-link hover:underline"
          >
            Recevoir un nouveau lien
          </Link>
        )}
        <PasswordField
          label="Nouveau mot de passe"
          name="password"
          autoComplete="new-password"
          hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}
          error={fieldErrors.password}
          onChange={() => {
            if (fieldErrors.password) setFieldErrors({});
          }}
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          required
          autoFocus
        />
        <PasswordField
          label="Confirmer le mot de passe"
          name="confirm"
          autoComplete="new-password"
          error={fieldErrors.confirm}
          onChange={() => {
            if (fieldErrors.confirm) setFieldErrors({});
          }}
          maxLength={MAX_PASSWORD_LENGTH}
          required
        />
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Enregistrement…" : "Enregistrer et me connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}

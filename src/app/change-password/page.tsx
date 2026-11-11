"use client";

import { useState } from "react";
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

// Première connexion d'un employé : le mot de passe temporaire donné par le
// patron doit être remplacé avant d'accéder au reste de l'application.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Erreur affichée sous le champ concerné
  const [fieldErrors, setFieldErrors] = useState<{ password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password"));

    const local = newPasswordErrors(password);
    setFieldErrors(local);
    if (local.password) {
      (formEl.elements.namedItem("password") as HTMLInputElement | null)?.focus();
      return;
    }

    setLoading(true);
    // Le changement ferme les sessions du compte côté serveur : on se
    // reconnecte aussitôt avec le nouveau mot de passe, sinon l'employé
    // serait déconnecté au prochain renouvellement de sa session.
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    const res = await callApi("/api/auth/change-password", { body: { password } });
    if (!res.ok) {
      setLoading(false);
      return setError(res.error);
    }
    if (email) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        router.replace("/login");
        router.refresh();
        return;
      }
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choisissez votre mot de passe
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Remplacez le mot de passe temporaire reçu du patron de l&apos;agence.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
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
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ce n&apos;est pas votre compte ?{" "}
        <button
          type="button"
          onClick={logout}
          className="font-medium text-link hover:underline"
        >
          Se déconnecter
        </button>
      </p>
    </AuthShell>
  );
}

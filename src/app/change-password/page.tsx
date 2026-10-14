"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError, PasswordField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";

// Première connexion d'un employé : le mot de passe temporaire donné par le
// patron doit être remplacé avant d'accéder au reste de l'application.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));

    if (password.length < 8)
      return setError("Mot de passe trop court (8 caractères minimum).");
    if (password !== confirm)
      return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    const res = await callApi("/api/auth/change-password", { body: { password } });
    if (!res.ok) {
      setLoading(false);
      return setError(res.error);
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
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choisissez votre mot de passe
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Remplacez le mot de passe temporaire reçu du patron de l&apos;agence.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <FormError message={error} />
        <PasswordField
          label="Nouveau mot de passe"
          name="password"
          autoComplete="new-password"
          hint="8 caractères minimum."
          minLength={8}
          maxLength={72}
          required
          autoFocus
        />
        <PasswordField
          label="Confirmer le mot de passe"
          name="confirm"
          autoComplete="new-password"
          maxLength={72}
          required
        />
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ce n&apos;est pas votre compte ?{" "}
        <button
          type="button"
          onClick={logout}
          className="font-medium text-primary hover:underline"
        >
          Se déconnecter
        </button>
      </p>
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PasswordField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { loadClient } from "@/lib/supabase/lazy-client";
import { forgetOtherPushDevices } from "@/features/notifications/push-client";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  newPasswordErrors,
} from "@/features/auth/schemas";

// Nouveau mot de passe, l'actuel à l'appui. Les autres appareils sont
// ensuite déconnectés : un mot de passe se change souvent parce qu'il a fui.
export function PasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setDone(false);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const currentPassword = String(form.get("currentPassword"));
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));

    if (!currentPassword) {
      return setErrors({ currentPassword: "Saisissez votre mot de passe actuel" });
    }
    const local = newPasswordErrors(password, confirm);
    if (local.password || local.confirm) return setErrors(local);

    setSaving(true);
    const res = await callApi("/api/settings/password", {
      body: { currentPassword, password },
    });
    if (!res.ok) {
      setSaving(false);
      setErrors(res.fieldErrors);
      // Erreur déjà affichée sous son champ : pas de doublon en bas
      if (Object.keys(res.fieldErrors).length === 0) setError(res.error);
      return;
    }

    // Le changement peut fermer les sessions du compte : on rouvre aussitôt
    // celle-ci avec le nouveau mot de passe, puis on ferme les autres
    const supabase = await loadClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      router.replace("/login");
      router.refresh();
      return;
    }
    await supabase.auth.signOut({ scope: "others" });
    await forgetOtherPushDevices({ keepThisDevice: true });
    setSaving(false);
    setDone(true);
    formEl.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {/* Aide aux gestionnaires de mots de passe : le compte concerné */}
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
      <PasswordField
        label="Mot de passe actuel"
        name="currentPassword"
        id="password-current"
        autoComplete="current-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={errors.currentPassword}
        required
      />
      <div className="grid gap-4 @md:grid-cols-2">
        <PasswordField
          label="Nouveau mot de passe"
          name="password"
          id="password-new"
          autoComplete="new-password"
          hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}
          maxLength={MAX_PASSWORD_LENGTH}
          error={errors.password}
          required
        />
        <PasswordField
          label="Confirmer le nouveau mot de passe"
          name="confirm"
          id="password-confirm"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          error={errors.confirm}
          required
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t pt-4">
        {error && (
          <p className="mr-auto text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-success" role="status">
            <CheckCircle2 className="size-4" aria-hidden /> Mot de passe changé : vos autres
            appareils sont déconnectés.
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
      </div>
    </form>
  );
}

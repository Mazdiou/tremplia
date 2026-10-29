"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField, FormError } from "@/components/auth/auth-field";
import { LoginSwitch } from "@/components/auth/login-switch";
import { callApi } from "@/lib/api-client";

// Connexion du candidat avec le code transmis par son agence
export default function StudentLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.trim() === "") return setError("Saisissez votre code.");
    setError(null);
    setLoading(true);
    const res = await callApi("/api/student/login", { body: { code } });
    if (!res.ok) {
      setLoading(false);
      return setError(res.error);
    }
    router.replace("/student");
    router.refresh();
  }

  return (
    <AuthShell>
      <LoginSwitch active="student" />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Espace candidat</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Entrez le code transmis par votre agence.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={error} />
        <AuthField
          label="Code d'accès"
          name="code"
          icon={KeyRound}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          autoFocus
          className="font-mono tracking-[0.2em] placeholder:tracking-[0.2em]"
        />
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" />
              Connexion…
            </>
          ) : (
            <>
              Accéder à mon dossier
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Pas de code ? Demandez-le à votre agence.
      </p>
    </AuthShell>
  );
}

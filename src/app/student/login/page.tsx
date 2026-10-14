"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/auth/auth-shell";
import { AuthField, FormError } from "@/components/auth/auth-field";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <div className="relative flex min-h-dvh flex-col bg-background px-5">
      <div className="flex h-16 items-center justify-end">
        <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-12 rounded-2xl" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Espace candidat</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Saisissez le code transmis par votre agence pour consulter votre dossier.
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
            className="h-11 font-mono text-base tracking-[0.2em] placeholder:tracking-[0.2em]"
          />
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <>
                Accéder à mon dossier <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Vous n&apos;avez pas de code ? Demandez-le à votre conseiller.
        </p>
      </main>
    </div>
  );
}

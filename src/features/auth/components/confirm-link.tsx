"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, MailCheck, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type LinkType = "recovery" | "email";

const TEXT = {
  recovery: {
    icon: KeyRound,
    title: "Choisir un nouveau mot de passe",
    body: "Continuez pour choisir le nouveau mot de passe de votre compte.",
    button: "Continuer",
    next: "/reset-password",
  },
  email: {
    icon: MailCheck,
    title: "Confirmer votre adresse",
    body: "Un dernier clic pour confirmer votre adresse e-mail et ouvrir votre compte.",
    button: "Confirmer mon adresse",
    next: "/dashboard",
  },
} as const;

// Le jeton est vérifié ici, dans le navigateur : la session ouverte est
// gardée dans les cookies, comme après une connexion.
export function ConfirmLink({ tokenHash, type }: { tokenHash: string | null; type: LinkType }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(tokenHash === null);
  const text = TEXT[type];

  async function confirm() {
    if (!tokenHash) return;
    setLoading(true);
    const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      setLoading(false);
      return setFailed(true);
    }
    router.replace(text.next);
    router.refresh();
  }

  if (failed) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-7" strokeWidth={1.8} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Lien expiré ou déjà utilisé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un lien ne sert qu&apos;une fois et reste valable 1 heure.{" "}
          {type === "recovery"
            ? "Demandez-en un nouveau."
            : "Adresse déjà confirmée ? Connectez-vous. Sinon, demandez un nouveau lien depuis la page de connexion."}
        </p>
        <Link
          href={type === "recovery" ? "/forgot-password" : "/login"}
          className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
        >
          {type === "recovery" ? "Recevoir un nouveau lien" : "Aller à la connexion"}
          <ArrowRight />
        </Link>
      </div>
    );
  }

  const Icon = text.icon;
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-7" strokeWidth={1.8} />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text.body}</p>
      <Button size="lg" disabled={loading} onClick={confirm} className="mt-8 w-full">
        {loading && <LoaderCircle className="animate-spin" />}
        {text.button}
        {!loading && <ArrowRight />}
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthField,
  FormError,
  PasswordField,
} from "@/components/auth/auth-field";
import { cn } from "@/lib/utils";

type Values = {
  agencyName: string;
  city: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
};

const EMPTY: Values = {
  agencyName: "",
  city: "",
  phone: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirm: "",
};

const STEPS = ["Votre agence", "Votre compte"];

function Stepper({ step }: { step: 0 | 1 }) {
  return (
    <ol className="mb-8 flex items-center gap-3" aria-label="Progression">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                done || current
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function bind(name: keyof Values) {
    return {
      name,
      value: values[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValues((v) => ({ ...v, [name]: e.target.value })),
    };
  }

  function nextStep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStep(1);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (values.password.length < 8)
      return setError("Mot de passe trop court (8 caractères minimum).");
    if (values.password !== values.confirm)
      return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    const { confirm, ...payload } = values;
    void confirm;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Le mot de passe n'a plus de raison de rester en mémoire
        setValues(EMPTY);
        setDone(true);
        return;
      }
      setError(
        (await res.json().catch(() => null))?.error ?? `Erreur ${res.status}`,
      );
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-bg text-success">
            <CircleCheck className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Votre agence est créée
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous avec votre e-mail et votre mot de passe pour
            commencer.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
          >
            Se connecter
            <ArrowRight />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link
        href="/login"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à la connexion
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Inscrire mon agence
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Deux étapes rapides pour démarrer.
        </p>
      </div>

      <Stepper step={step} />

      {step === 0 ? (
        <form onSubmit={nextStep} className="space-y-5">
          <AuthField
            label="Nom de l'agence"
            icon={Building2}
            autoComplete="organization"
            placeholder="Agence Horizon"
            maxLength={100}
            required
            autoFocus
            {...bind("agencyName")}
          />
          <AuthField
            label="Ville"
            icon={MapPin}
            autoComplete="address-level2"
            maxLength={100}
            required
            {...bind("city")}
          />
          <AuthField
            label="Téléphone de l'agence"
            type="tel"
            icon={Phone}
            autoComplete="tel"
            minLength={6}
            maxLength={30}
            required
            {...bind("phone")}
          />
          <Button type="submit" size="lg" className="w-full">
            Continuer
            <ArrowRight />
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <FormError message={error} />

          <div className="grid gap-5 sm:grid-cols-2">
            <AuthField
              label="Prénom"
              icon={User}
              autoComplete="given-name"
              maxLength={100}
              required
              autoFocus
              {...bind("firstName")}
            />
            <AuthField
              label="Nom"
              autoComplete="family-name"
              maxLength={100}
              required
              {...bind("lastName")}
            />
          </div>
          <AuthField
            label="Adresse e-mail"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="vous@agence.com"
            maxLength={254}
            required
            {...bind("email")}
          />
          <PasswordField
            label="Mot de passe"
            autoComplete="new-password"
            hint="8 caractères minimum"
            minLength={8}
            maxLength={72}
            required
            {...bind("password")}
          />
          <PasswordField
            label="Confirmer le mot de passe"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            {...bind("confirm")}
          />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => {
                setError(null);
                setStep(0);
              }}
            >
              <ArrowLeft />
              Retour
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Création...
                </>
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </div>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}

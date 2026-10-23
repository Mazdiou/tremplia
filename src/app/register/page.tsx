"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LoaderCircle,
  Mail,
  MailCheck,
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
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT,
} from "@/features/auth/schemas";

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
  // Inscription réussie : adresse à confirmer, et l'e-mail est-il parti ?
  const [done, setDone] = useState<{ email: string; emailSent: boolean } | null>(null);

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

    if (values.password.length < MIN_PASSWORD_LENGTH) return setError(`${PASSWORD_TOO_SHORT}.`);
    if (values.password !== values.confirm)
      return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    const { confirm, ...payload } = values;
    void confirm;
    const res = await callApi<{ emailSent?: boolean }>("/api/auth/register", { body: payload });
    if (res.ok) {
      // Le mot de passe n'a plus de raison de rester en mémoire
      setValues(EMPTY);
      setDone({ email: payload.email.trim().toLowerCase(), emailSent: res.data.emailSent !== false });
      return;
    }
    setError(res.error);
    setLoading(false);
  }

  if (done) {
    return (
      <AuthShell compact>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-bg text-success">
            <MailCheck className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Confirmez votre adresse e-mail
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done.emailSent ? (
              <>
                Votre agence est créée. Un e-mail vient de partir à{" "}
                <span className="font-medium text-foreground">{done.email}</span> : cliquez
                sur le lien qu&apos;il contient pour ouvrir votre compte. Le lien est valable
                1 heure.
              </>
            ) : (
              <>
                Votre agence est créée, mais l&apos;e-mail de confirmation n&apos;a pas pu
                partir vers <span className="font-medium text-foreground">{done.email}</span>.
                Demandez-en un nouveau ci-dessous.
              </>
            )}
          </p>
          {done.emailSent && (
            <p className="mt-2 text-sm text-muted-foreground">
              Rien reçu ? Regardez dans les courriers indésirables.
            </p>
          )}
          <div className="mt-6 flex justify-center">
            <ResendConfirmation email={done.email} />
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8 w-full")}
          >
            Aller à la connexion
            <ArrowRight />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell compact>
      <Link
        href="/login"
        className="touch-target mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            placeholder="Ex. : Agence Horizon"
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
            hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            required
            {...bind("password")}
          />
          <PasswordField
            label="Confirmer le mot de passe"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
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
                  Création…
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
          className="font-medium text-link hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}

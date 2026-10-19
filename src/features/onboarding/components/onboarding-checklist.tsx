"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, PartyPopper, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { buildSteps, firstOpenStep, type OnboardingProgress } from "../steps";

// Guide « Bien démarrer » du tableau de bord (patron d'une nouvelle agence) :
// six étapes qui se cochent d'après les données. Une seule est dépliée à la
// fois, la prochaine à faire au départ. La croix masque le guide pour toute
// l'agence (réaffichable dans les réglages).
export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const router = useRouter();
  const steps = buildSteps(progress);
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  // undefined : l'étape suivante, qui change à mesure que les étapes se font
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const openId = picked === undefined ? firstOpenStep(steps) : picked;
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hide() {
    setHidden(true);
    setError(null);
    const res = await callApi("/api/onboarding/guide", {
      method: "PUT",
      body: { hidden: true },
    });
    if (!res.ok) {
      setHidden(false);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (hidden) return null;

  if (allDone) {
    return (
      <section
        aria-label="Bien démarrer"
        className="flex items-center gap-4 rounded-2xl border bg-card px-5 py-4"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-bg text-success">
          <PartyPopper className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Tout est prêt</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vous avez fait le tour de l&apos;essentiel. Bonne campagne !
          </p>
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => void hide()}>
          Masquer
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="onboarding-title"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-title" className="text-sm font-semibold">
            Bien démarrer
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quelques étapes pour prendre l&apos;outil en main.
          </p>
        </div>
        <span className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {doneCount} sur {steps.length}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mt-0.5 -mr-1.5 text-muted-foreground"
          aria-label="Masquer le guide"
          title="Masquer le guide"
          onClick={() => void hide()}
        >
          <X />
        </Button>
      </div>

      {/* Avancement : un segment par étape */}
      <div
        role="progressbar"
        aria-label="Avancement"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        className="flex gap-1 px-5 pb-3"
      >
        {steps.map((s) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-500",
              s.done ? "bg-primary" : "bg-muted dark:bg-white/10",
            )}
          />
        ))}
      </div>
      {error && <p className="px-5 pb-3 text-sm text-destructive">{error}</p>}

      <ol className="border-t">
        {steps.map((s, i) => {
          const open = s.id === openId;
          return (
            <li key={s.id} className="border-b last:border-b-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`onboarding-${s.id}`}
                onClick={() => setPicked(open ? null : s.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <StepMark done={s.done} current={open} index={i + 1} />
                <span
                  className={cn("min-w-0 flex-1 font-medium", s.done && "text-muted-foreground")}
                >
                  {s.title}
                  {s.done && <span className="sr-only"> (fait)</span>}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <div
                id={`onboarding-${s.id}`}
                inert={!open}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="pr-5 pb-4 pl-14">
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {s.action ? (
                        <Link
                          href={s.action.href}
                          className={cn(
                            buttonVariants({
                              size: "sm",
                              variant: s.done ? "outline" : "default",
                            }),
                            "max-sm:w-full",
                          )}
                        >
                          {s.action.label}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {progress.hasCampaign
                            ? "Ajoutez d'abord un dossier."
                            : "Créez d'abord une campagne."}
                        </p>
                      )}
                      {s.secondary && !s.done && (
                        <Link
                          href={s.secondary.href}
                          className="text-sm font-medium text-link hover:underline max-sm:mx-auto"
                        >
                          {s.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Pastille de l'étape : coche si faite, numéro sinon (cerclé si dépliée)
function StepMark({ done, current, index }: { done: boolean; current: boolean; index: number }) {
  if (done) {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
        current ? "border-primary text-link" : "text-muted-foreground",
      )}
    >
      {index}
    </span>
  );
}

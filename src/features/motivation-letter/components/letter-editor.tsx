"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MAX_LETTER_LENGTH } from "../schemas";

const LEAVE_WARNING = "La lettre a des modifications non enregistrées. Quitter quand même ?";

// Lettre de motivation du dossier : une grande zone de texte simple.
// Ctrl+S enregistre ; quitter la page avec des modifications demande
// confirmation.
export function LetterEditor({
  caseId,
  initial,
  lastEdit,
}: {
  caseId: string;
  initial: string;
  // « par Sara Benali, le 14 oct. 2026 à 10:32 », ou null si jamais écrite
  lastEdit: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [content, setContent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const dirty = content !== saved;

  async function save() {
    if (!dirty || saving) return;
    setMessage(null);
    setSaving(true);
    const res = await callApi(`/api/cases/${caseId}/motivation-letter`, {
      method: "PUT",
      body: { content },
    });
    setSaving(false);
    if (!res.ok) {
      setMessage({ text: res.error, error: true });
      return;
    }
    setSaved(content);
    setMessage({ text: "Lettre enregistrée", error: false });
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage({ text: "Copie impossible : sélectionnez le texte et copiez-le à la main.", error: true });
    }
  }

  // Modifications non enregistrées : confirmation avant de fermer l'onglet
  // du navigateur, ou de suivre un lien de l'application (onglets, arbre…)
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(LEAVE_WARNING)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lettre de motivation</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lastEdit ? `Dernière modification ${lastEdit}.` : "Aucune lettre pour le moment."}{" "}
            Visible par toute l&apos;agence.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void copy()} disabled={!content}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiée" : "Copier"}
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </div>

      <label htmlFor="motivation-letter" className="sr-only">
        Texte de la lettre de motivation
      </label>
      <textarea
        id="motivation-letter"
        value={content}
        maxLength={MAX_LETTER_LENGTH}
        disabled={saving}
        spellCheck
        lang="fr"
        placeholder={"Madame, Monsieur,\n\nRédigez ici la lettre de motivation du candidat…"}
        onChange={(e) => {
          setContent(e.target.value);
          setMessage(null);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            void save();
          }
        }}
        className="min-h-[24rem] w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p
          role="status"
          aria-live="polite"
          className={cn(
            message?.error ? "text-destructive" : "text-muted-foreground",
            !message && dirty && "font-medium text-foreground",
          )}
        >
          {message?.text ?? (dirty ? "Modifications non enregistrées · Ctrl + S pour enregistrer" : "")}
        </p>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {content.length.toLocaleString("fr-FR")} / {MAX_LETTER_LENGTH.toLocaleString("fr-FR")}
        </span>
      </div>
    </div>
  );
}

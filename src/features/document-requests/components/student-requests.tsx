"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CircleCheck,
  CircleDashed,
  Eye,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type PillTone } from "@/components/page-ui";
import { callApi } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { openSignedLink } from "@/features/documents/open-document";
import { pdfProblem } from "@/features/documents/upload";
import {
  MAX_PHOTOS_PER_PDF,
  PhotoError,
  isImageFile,
  photosToPdf,
} from "@/features/documents/photo-pdf";
import { PhotoComposer, usePhotoPages } from "@/features/documents/components/photo-composer";
import { sendStudentPiece } from "../upload";
import type { StudentRequestItem } from "../types";

// Pièces que l'agence demande au candidat. Pour chacune : envoyer un PDF ou
// des photos (assemblées en un PDF), puis voir, remplacer ou retirer ce qui
// a été envoyé tant que l'agence ne l'a pas acceptée.

const STATUS: Record<StudentRequestItem["status"], { label: string; tone: PillTone }> = {
  pending: { label: "À envoyer", tone: "warn" },
  sent: { label: "Envoyée", tone: "info" },
  accepted: { label: "Acceptée", tone: "ok" },
};

type Note = { id: string; text: string; error: boolean } | null;

// Première lettre en majuscule (messages de pdfProblem, en minuscules)
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function StudentRequests({
  requests,
  agencyName,
  readOnly,
}: {
  requests: StudentRequestItem[];
  agencyName: string;
  // Agence en lecture seule (abonnement expiré) : consultation seulement
  readOnly: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Pièce qui recevra les fichiers choisis
  const target = useRef<string | null>(null);
  const photos = usePhotoPages();
  // Pièce dont les photos sont en cours d'assemblage
  const [composing, setComposing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Envoi ou retrait en cours : la pièce, et l'étape affichée
  const [working, setWorking] = useState<{ id: string; text: string } | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);

  const sent = requests.filter((r) => r.status !== "pending").length;
  const allSent = sent === requests.length;
  const allAccepted = requests.every((r) => r.status === "accepted");
  const busy = working !== null;

  const say = (id: string, text: string, error = false) => setNote({ id, text, error });

  function pick(id: string) {
    target.current = id;
    inputRef.current?.click();
  }

  // Fichiers choisis ou déposés pour une pièce : un PDF est envoyé tout de
  // suite ; des photos ouvrent l'assemblage
  function handleFiles(r: StudentRequestItem, files: File[]) {
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0 || busy) return;
    setNote(null);
    setConfirming(null);

    const images = files.filter(isImageFile);
    const others = files.filter((f) => !isImageFile(f));
    if (images.length > 0 && others.length > 0) {
      say(r.id, "Choisissez soit un PDF, soit des photos.", true);
      return;
    }
    if (others.length > 1) {
      say(r.id, "Un seul PDF par pièce : choisissez un seul fichier.", true);
      return;
    }
    if (others.length === 1) {
      const problem = pdfProblem(others[0]);
      if (problem) {
        say(r.id, `${sentence(problem)}.`, true);
        return;
      }
      setComposing(null);
      photos.clear();
      void upload(r, others[0]);
      return;
    }

    if (composing !== r.id) photos.clear();
    const skipped = photos.add(images);
    setComposing(r.id);
    if (skipped > 0) {
      say(r.id, `${MAX_PHOTOS_PER_PDF} photos au plus par pièce : ${skipped} laissée(s) de côté.`, true);
    }
  }

  // Renvoie vrai si la pièce est envoyée
  async function upload(r: StudentRequestItem, file: File) {
    setWorking({ id: r.id, text: "Envoi en cours…" });
    const error = await sendStudentPiece(r.id, file);
    setWorking(null);
    if (error) {
      say(r.id, error, true);
      router.refresh();
      return false;
    }
    say(
      r.id,
      r.status === "pending"
        ? `Pièce envoyée. ${agencyName} va la vérifier.`
        : `Pièce remplacée. ${agencyName} va la vérifier.`,
    );
    router.refresh();
    return true;
  }

  async function sendPhotos(r: StudentRequestItem) {
    const files = photos.pages.map((p) => p.file);
    if (files.length === 0) return;
    setNote(null);
    try {
      const bytes = await photosToPdf(files, (n) =>
        setWorking({
          id: r.id,
          text: files.length > 1 ? `Préparation de la page ${n} sur ${files.length}…` : "Préparation du PDF…",
        }),
      );
      const pdf = new File([bytes as BlobPart], `${r.label}.pdf`, { type: "application/pdf" });
      if (await upload(r, pdf)) {
        photos.clear();
        setComposing(null);
      }
    } catch (e) {
      setWorking(null);
      say(r.id, e instanceof PhotoError ? e.message : "La préparation du PDF a échoué, réessayez.", true);
    }
  }

  async function remove(r: StudentRequestItem) {
    setWorking({ id: r.id, text: "Retrait en cours…" });
    const res = await callApi(`/api/student/documents/${r.id}`, { method: "DELETE" });
    setWorking(null);
    setConfirming(null);
    if (!res.ok) say(r.id, res.error, true);
    else say(r.id, "Pièce retirée : vous pouvez en envoyer une autre.");
    router.refresh();
  }

  async function open(r: StudentRequestItem) {
    setNote(null);
    const error = await openSignedLink(`/api/student/documents/${r.id}/open`);
    if (error) say(r.id, error, true);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {agencyName} vous demande {plural(requests.length, "pièce")}. Envoyez chacune en PDF ou en
          photos (10&nbsp;Mo maximum par pièce).{" "}
          {!readOnly && !allAccepted && (
            <>
              <span className="sm:hidden">
                «&nbsp;Envoyer&nbsp;» vous propose aussi de la prendre en photo.
              </span>
              <span className="max-sm:hidden">
                Vous pouvez aussi glisser un fichier sur la pièce.
              </span>
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(sent / requests.length) * 100}%` }}
            />
          </div>
          <p className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
            {sent} sur {requests.length} {sent > 1 ? "envoyées" : "envoyée"}
          </p>
        </div>
      </div>

      {allSent && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-sm text-success"
        >
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          {allAccepted
            ? `Toutes vos pièces ont été acceptées par ${agencyName}.`
            : `Tout est envoyé. ${agencyName} va vérifier vos pièces.`}
        </p>
      )}

      <ul className="divide-y rounded-xl border bg-card">
        {requests.map((r) => {
          const status = STATUS[r.status];
          const canChange = !readOnly && r.status !== "accepted";
          const rowWorking = working?.id === r.id;
          const rowNote = note?.id === r.id ? note : null;
          return (
            <li
              key={r.id}
              aria-label={r.label}
              onDragOver={(e) => {
                if (!canChange || busy || !Array.from(e.dataTransfer.types).includes("Files")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (dropOn !== r.id) setDropOn(r.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropOn(null);
              }}
              onDrop={(e) => {
                if (!canChange) return;
                e.preventDefault();
                setDropOn(null);
                handleFiles(r, Array.from(e.dataTransfer.files));
              }}
              className={cn(
                "space-y-3 px-4 py-3.5 transition-colors",
                dropOn === r.id && "bg-accent/60",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {r.status === "pending" ? (
                    <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : r.status === "sent" ? (
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium break-words">{r.label}</span>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </p>
                    {r.document && (
                      <p className="mt-0.5 text-xs break-all text-muted-foreground">
                        {r.status === "accepted" ? "Acceptée par votre agence. " : ""}
                        Envoyée le {r.document.dateLabel} : {r.document.fileName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 max-sm:pl-8">
                  {rowWorking ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {working?.text}
                    </p>
                  ) : confirming === r.id ? (
                    <>
                      <span className="text-sm">Retirer ce document ?</span>
                      <Button variant="destructive" size="sm" onClick={() => void remove(r)}>
                        Retirer
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <>
                      {r.status === "pending" && canChange && composing !== r.id && (
                        <Button size="sm" disabled={busy} onClick={() => pick(r.id)}>
                          <Upload aria-hidden /> Envoyer
                        </Button>
                      )}
                      {r.document && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void open(r)}
                          aria-label={`Voir ${r.label}`}
                        >
                          <Eye aria-hidden /> Voir
                        </Button>
                      )}
                      {r.status === "sent" && canChange && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => pick(r.id)}
                            aria-label={`Remplacer ${r.label}`}
                          >
                            <RefreshCw aria-hidden /> Remplacer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setNote(null);
                              setConfirming(r.id);
                            }}
                            aria-label={`Retirer ${r.label}`}
                          >
                            <Trash2 aria-hidden /> Retirer
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {rowNote && (
                <p
                  role={rowNote.error ? "alert" : "status"}
                  className={cn(
                    "text-sm sm:pl-8",
                    rowNote.error ? "text-red-700 dark:text-destructive" : "text-success",
                  )}
                >
                  {rowNote.text}
                </p>
              )}

              {composing === r.id && photos.pages.length > 0 && (
                <PhotoComposer
                  pages={photos.pages}
                  piece={r.label}
                  busy={rowWorking}
                  progress={null}
                  onAdd={(files) => {
                    const skipped = photos.add(files.filter(isImageFile));
                    if (skipped > 0) {
                      say(r.id, `${MAX_PHOTOS_PER_PDF} photos au plus par pièce : ${skipped} laissée(s) de côté.`, true);
                    }
                  }}
                  onRemove={(id) => {
                    photos.remove(id);
                    if (photos.pages.length <= 1) setComposing(null);
                  }}
                  onMove={photos.move}
                  onCancel={() => {
                    photos.clear();
                    setComposing(null);
                  }}
                  onSubmit={() => void sendPhotos(r)}
                />
              )}
            </li>
          );
        })}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,image/*"
        multiple
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const r = requests.find((x) => x.id === target.current);
          if (r) handleFiles(r, Array.from(e.target.files ?? []));
        }}
      />
    </div>
  );
}

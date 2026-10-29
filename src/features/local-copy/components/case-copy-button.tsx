"use client";

import { useEffect, useRef } from "react";
import { Loader2, MonitorDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copySummary } from "../summary";
import { useLocalCopy } from "./local-copy-provider";

// Fiche du candidat › Documents : mettre à jour la copie de ce candidat sur
// l'ordinateur. N'apparaît qu'une fois un dossier de copie choisi (Réglages).
export function CaseCopyButton({
  caseId,
  onMessage,
}: {
  caseId: string;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const copy = useLocalCopy();
  if (!copy?.supported || !copy.config) return null;

  const mine = copy.running?.caseId === caseId ? copy.running : null;

  async function update() {
    const outcome = await copy!.run({ caseId, manual: true });
    if (!outcome.ok) onMessage(outcome.error, true);
    else {
      const s = copySummary(outcome.result);
      onMessage(s.text, s.error);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={copy.running !== null}
      onClick={() => void update()}
      title="Mettre à jour la copie sur cet ordinateur"
    >
      {mine ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span role="status">{mine.total > 0 ? `${mine.done} / ${mine.total}` : "Copie…"}</span>
        </>
      ) : (
        <>
          <MonitorDown aria-hidden /> Copier sur l&apos;ordinateur
        </>
      )}
    </Button>
  );
}

// Copie automatique : quand les documents du candidat changent (ajout,
// renommage, déplacement, suppression, dossiers de rangement), par soi ou par
// un collègue. Pas à l'ouverture de la fiche : le rattrapage à l'ouverture de
// Tremplia s'en charge.
export function useAutoCaseCopy(
  caseId: string,
  signature: string,
  onMessage: (text: string, error?: boolean) => void,
) {
  const copy = useLocalCopy();
  const latest = useRef({ copy, onMessage });
  const previous = useRef<{ caseId: string; signature: string } | null>(null);

  useEffect(() => {
    latest.current = { copy, onMessage };
  });

  useEffect(() => {
    const before = previous.current;
    previous.current = { caseId, signature };
    if (!before || before.caseId !== caseId || before.signature === signature) return;
    const { copy: c } = latest.current;
    if (!c?.config?.auto || c.permission !== "granted") return;
    void c.run({ caseId, manual: false }).then((outcome) => {
      // Une copie réussie reste discrète ; un problème se signale
      if (!outcome.ok) latest.current.onMessage(`Copie sur l'ordinateur : ${outcome.error}`, true);
      else if (outcome.result.failed > 0) {
        latest.current.onMessage(copySummary(outcome.result).text, true);
      }
    });
  }, [caseId, signature]);
}

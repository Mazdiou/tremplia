"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { zipSync } from "fflate";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { saveFile } from "@/lib/save-file";

type Archive = { fileName: string; files: { path: string; url: string }[] };

// Tous les documents du dossier dans une archive ZIP, construite ici : le
// serveur ne donne que des liens signés (une réponse de plusieurs dizaines de
// Mo dépasserait la limite de Vercel). Les PDF sont déjà compressés : ils sont
// rangés tels quels dans l'archive (niveau 0), ce qui est quasi instantané.
export function DownloadArchiveButton({
  caseId,
  onMessage,
}: {
  caseId: string;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [progress, setProgress] = useState<string | null>(null);

  async function download() {
    setProgress("Préparation…");
    const res = await callApi<Archive>(`/api/cases/${caseId}/documents/archive`);
    if (!res.ok) {
      setProgress(null);
      onMessage(res.error, true);
      return;
    }

    const { fileName, files } = res.data;
    const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
    try {
      for (const [i, f] of files.entries()) {
        setProgress(`${i + 1} / ${files.length}`);
        const r = await fetch(f.url);
        if (!r.ok) throw new Error(String(r.status));
        entries[f.path] = [new Uint8Array(await r.arrayBuffer()), { level: 0 }];
      }
    } catch {
      setProgress(null);
      onMessage("Un document n'a pas pu être téléchargé. Vérifiez votre connexion et réessayez.", true);
      return;
    }

    const zip = zipSync(entries);
    saveFile(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), fileName);
    setProgress(null);
    onMessage(`${plural(files.length, "document téléchargé", "documents téléchargés")} (ZIP)`);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={progress !== null}
      onClick={() => void download()}
      title="Télécharger tous les documents dans une archive ZIP"
    >
      {progress ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span role="status">{progress}</span>
        </>
      ) : (
        <>
          <Download /> Tout télécharger
        </>
      )}
    </Button>
  );
}

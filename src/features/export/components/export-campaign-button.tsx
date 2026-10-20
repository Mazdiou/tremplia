"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NETWORK_ERROR } from "@/lib/api-client";
import { saveFile } from "@/lib/save-file";

// Nom proposé par le serveur (filename*, sinon filename)
function fileNameOf(res: Response) {
  const header = res.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {}
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? "export.xlsx";
}

// Téléchargement du classeur Excel d'une campagne (patron seulement)
export function ExportCampaignButton({ campaignId }: { campaignId: string }) {
  return <ExcelDownloadButton url={`/api/campaigns/${campaignId}/export`} />;
}

// Téléchargement d'un classeur Excel. Le fichier passe par le navigateur
// pour qu'une erreur s'affiche ici au lieu d'être téléchargée.
export function ExcelDownloadButton({ url }: { url: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof data?.error === "string" ? data.error : `Erreur ${res.status}`);
        return;
      }
      saveFile(await res.blob(), fileNameOf(res));
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" onClick={download} disabled={busy}>
        <Download /> {busy ? "Préparation…" : "Exporter en Excel"}
      </Button>
      {error && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-max max-w-xs text-right text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

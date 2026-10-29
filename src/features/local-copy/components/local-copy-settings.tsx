"use client";

import { useState } from "react";
import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { dateTimeFormat } from "@/lib/dates";
import { plural } from "@/lib/plural";
import { copySummary } from "../summary";
import { useLocalCopy } from "./local-copy-provider";

// Réglages › Sur cet ordinateur : choisir le dossier de copie, la mettre à
// jour, copie automatique, arrêter
export function LocalCopySettings() {
  const copy = useLocalCopy();
  const [message, setMessage] = useState<ActionMessage>(null);
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  if (!copy || !copy.ready) {
    return <p className="min-h-10 text-sm text-muted-foreground">Chargement…</p>;
  }

  if (!copy.supported) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Disponible avec Chrome ou Edge, sur ordinateur. Ce navigateur ne permet pas à un site
        d&apos;écrire dans un dossier.
      </p>
    );
  }

  const { config, running } = copy;

  async function choose() {
    setMessage(null);
    setBusy(true);
    const { chosen, error } = await copy!.choose();
    setBusy(false);
    if (error) setMessage({ text: error, error: true });
    // Première copie tout de suite (fenêtre fermée sans choix : rien ne change)
    else if (chosen) await update();
  }

  async function update() {
    setMessage(null);
    const outcome = await copy!.run({ manual: true });
    setMessage(outcome.ok ? copySummary(outcome.result) : { text: outcome.error, error: true });
  }

  if (!config) {
    return (
      <div className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Cliquez sur « Choisir le dossier ». Dans la fenêtre, créez un dossier (par exemple
            « Tremplia » sur le Bureau) et choisissez-le.
          </li>
          <li>Acceptez que Tremplia modifie les fichiers de ce dossier.</li>
          <li>
            Vos campagnes, groupes et candidats y sont copiés, puis mis à jour tant que Tremplia
            est ouvert sur cet ordinateur.
          </li>
        </ol>
        <Button onClick={() => void choose()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <FolderOpen aria-hidden />}
          Choisir le dossier
        </Button>
        <StatusMessage message={message} />
      </div>
    );
  }

  const last = config.last;
  const progress =
    running && !running.caseId
      ? running.total > 0
        ? `Copie… ${running.done} / ${running.total}`
        : "Vérification…"
      : null;

  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Dossier</dt>
          <dd className="font-medium break-all">{copy.folderLabel ?? config.handle.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dernière mise à jour complète</dt>
          <dd className="font-medium">
            {last ? (
              <>
                {dateTimeFormat.format(new Date(last.at))}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({plural(last.copied + last.unchanged, "fichier", "fichiers")}
                  {last.failed > 0 && `, ${plural(last.failed, "échec", "échecs")}`})
                </span>
              </>
            ) : (
              "Jamais"
            )}
          </dd>
        </div>
      </dl>

      {copy.permission !== "granted" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Chrome demande de nouveau l&apos;autorisation d&apos;écrire dans ce dossier : cliquez sur
          « Mettre à jour maintenant », puis acceptez.
        </p>
      )}
      {copy.autoError && !message && (
        <p role="alert" className="text-sm text-destructive">
          Dernière copie automatique : {copy.autoError}
        </p>
      )}

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={config.auto}
          onChange={(e) => void copy.setAuto(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          Copier automatiquement
          <span className="block text-xs text-muted-foreground">
            À l&apos;ouverture de Tremplia et dès qu&apos;un document change dans un dossier
            ouvert. Sinon, seulement avec le bouton.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void update()} disabled={running !== null}>
          {progress ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {progress ? <span role="status">{progress}</span> : "Mettre à jour maintenant"}
        </Button>
        <Button variant="outline" onClick={() => void choose()} disabled={busy || running !== null}>
          Changer de dossier
        </Button>
        <Button
          variant="ghost"
          onClick={() => setConfirmStop(true)}
          disabled={running !== null}
        >
          Arrêter la copie
        </Button>
      </div>
      <StatusMessage message={message} />

      <ConfirmDialog
        open={confirmStop}
        title="Arrêter la copie sur cet ordinateur ?"
        body="Les fichiers déjà copiés restent dans le dossier : vous pouvez les supprimer vous-même. Vous pourrez reprendre la copie plus tard."
        confirmLabel="Arrêter la copie"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          setMessage(null);
          void copy.forget();
        }}
      />
    </div>
  );
}

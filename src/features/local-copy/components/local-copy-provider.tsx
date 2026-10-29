"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { callApi } from "@/lib/api-client";
import {
  COPY_FOLDER_NAME,
  clearConfig,
  copyRootLabel,
  folderPermission,
  isLocalCopySupported,
  loadConfig,
  openCopyRoot,
  pickFolder,
  saveConfig,
  type LocalCopyConfig,
} from "../browser";
import { buildCopyPlan, type PlanData } from "../plan";
import { OtherAgencyError, copyOwner, syncCopy, type SyncResult } from "../sync";

// Copie des documents sur l'ordinateur : état partagé par les Réglages et la
// fiche du candidat, et mise à jour de rattrapage à l'ouverture de Tremplia.

export type RunOutcome =
  | { ok: true; result: SyncResult }
  | { ok: false; error: string };

type Running = { caseId: string | null; done: number; total: number };

type LocalCopy = {
  supported: boolean;
  // Réglage lu (IndexedDB) : avant, rien n'est affiché
  ready: boolean;
  config: LocalCopyConfig | null;
  // « prompt » : Chrome redemandera l'accès au prochain clic
  permission: "granted" | "denied" | "prompt" | null;
  folderLabel: string | null;
  running: Running | null;
  // Dernière erreur d'une copie automatique (sinon elle passerait inaperçue)
  autoError: string | null;
  // `chosen` : un dossier a été choisi et retenu
  choose: () => Promise<{ chosen: boolean; error: string | null }>;
  forget: () => Promise<void>;
  setAuto: (auto: boolean) => Promise<void>;
  run: (opts: { caseId?: string; manual: boolean }) => Promise<RunOutcome>;
};

const Context = createContext<LocalCopy | null>(null);

export function useLocalCopy() {
  return useContext(Context);
}

const CATCH_UP_KEY = "tremplia-copie-rattrapage";
const LOCK = "tremplia-copie-locale";

// Une seule mise à jour à la fois, même entre deux onglets
function exclusive<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK, run) as Promise<T>;
  }
  return run();
}

function errorMessage(e: unknown): string {
  if (e instanceof OtherAgencyError) {
    return "Ce dossier contient la copie d'une autre agence. Choisissez un autre dossier.";
  }
  const name = e instanceof Error ? e.name : "";
  if (name === "NotFoundError") {
    return "Le dossier de copie a été déplacé ou supprimé. Choisissez-le à nouveau.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Chrome n'autorise plus l'accès au dossier. Cliquez sur « Mettre à jour maintenant ».";
  }
  if (name === "QuotaExceededError") return "Plus assez de place sur le disque.";
  return "La copie a échoué. Vérifiez votre connexion et réessayez.";
}

export function LocalCopyProvider({
  agencyId,
  userId,
  children,
}: {
  agencyId: string;
  userId: string;
  children: React.ReactNode;
}) {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<LocalCopyConfig | null>(null);
  const [permission, setPermission] = useState<LocalCopy["permission"]>(null);
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  // Le réglage le plus récent, pour les fonctions appelées plus tard
  const configRef = useRef<LocalCopyConfig | null>(null);

  const refreshFolder = useCallback(async (c: LocalCopyConfig | null) => {
    if (!c) {
      setPermission(null);
      setFolderLabel(null);
      return;
    }
    const p = await folderPermission(c.handle, false).catch(() => "denied" as const);
    setPermission(p);
    setFolderLabel(p === "granted" ? await copyRootLabel(c.handle).catch(() => c.handle.name) : c.handle.name);
  }, []);

  const store = useCallback(
    async (c: LocalCopyConfig | null) => {
      configRef.current = c;
      setConfig(c);
      if (c) await saveConfig(userId, c).catch(() => {});
      else await clearConfig(userId).catch(() => {});
    },
    [userId],
  );

  const run = useCallback(
    async ({ caseId, manual }: { caseId?: string; manual: boolean }): Promise<RunOutcome> => {
      const c = configRef.current;
      if (!c) return { ok: false, error: "Choisissez d'abord un dossier de copie dans les Réglages." };
      const p = await folderPermission(c.handle, manual).catch(() => "denied" as const);
      setPermission(p);
      if (p !== "granted") {
        return {
          ok: false,
          error: "Autorisez l'accès au dossier de copie : Réglages › Sur cet ordinateur.",
        };
      }

      return exclusive(async () => {
        setRunning({ caseId: caseId ?? null, done: 0, total: 0 });
        try {
          const root = await openCopyRoot(c.handle);
          const res = await callApi<PlanData>("/api/local-copy/plan", { body: { caseId } });
          if (!res.ok) return { ok: false as const, error: res.error };

          const result = await syncCopy({
            root,
            agencyId,
            plan: buildCopyPlan(res.data),
            scopeCaseId: caseId,
            getUrls: async (ids, batch) => {
              const r = await callApi<{ urls: { id: string; url: string }[] }>("/api/local-copy/urls", {
                body: {
                  ids,
                  caseId,
                  // Au journal : une mise à jour demandée, pas une copie automatique
                  logCount: manual && batch.first ? batch.total : undefined,
                },
              });
              if (!r.ok) throw new Error(r.error);
              return new Map(r.data.urls.map((u) => [u.id, u.url]));
            },
            fetchFile: async (url) => {
              const r = await fetch(url);
              if (!r.ok) throw new Error(String(r.status));
              return r.blob();
            },
            onProgress: (done, total) => setRunning({ caseId: caseId ?? null, done, total }),
          });

          // Copie arrêtée entre-temps : on ne la réenregistre pas
          const latest = configRef.current;
          if (!caseId && latest) {
            await store({ ...latest, last: { at: new Date().toISOString(), ...result } });
          }
          if (!manual) setAutoError(null);
          return { ok: true as const, result };
        } catch (e) {
          const message = errorMessage(e);
          if (!manual) setAutoError(message);
          return { ok: false as const, error: message };
        } finally {
          setRunning(null);
        }
      });
    },
    [agencyId, store],
  );

  // Lecture du réglage, puis rattrapage une fois par session du navigateur
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isLocalCopySupported()) {
        setReady(true);
        return;
      }
      setSupported(true);
      const c = await loadConfig(userId);
      if (cancelled) return;
      configRef.current = c;
      setConfig(c);
      await refreshFolder(c);
      setReady(true);
      if (!c?.auto) return;
      try {
        if (sessionStorage.getItem(CATCH_UP_KEY)) return;
        sessionStorage.setItem(CATCH_UP_KEY, "1");
      } catch {
        return;
      }
      void run({ manual: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshFolder, run]);

  const choose = useCallback(async () => {
    let handle: FileSystemDirectoryHandle | null;
    try {
      handle = await pickFolder();
    } catch {
      return {
        chosen: false,
        error: `Ce dossier ne peut pas être choisi. Créez un dossier « ${COPY_FOLDER_NAME} », sur le Bureau par exemple, et choisissez-le.`,
      };
    }
    if (!handle) return { chosen: false, error: null };
    try {
      const owner = await copyOwner(await openCopyRoot(handle));
      if (owner !== null && owner !== agencyId) {
        return { chosen: false, error: errorMessage(new OtherAgencyError()) };
      }
    } catch (e) {
      return { chosen: false, error: errorMessage(e) };
    }
    const next: LocalCopyConfig = { handle, auto: configRef.current?.auto ?? true, last: null };
    await store(next);
    await refreshFolder(next);
    return { chosen: true, error: null };
  }, [agencyId, store, refreshFolder]);

  const forget = useCallback(async () => {
    await store(null);
    await refreshFolder(null);
    setAutoError(null);
  }, [store, refreshFolder]);

  const setAuto = useCallback(
    async (auto: boolean) => {
      const c = configRef.current;
      if (c) await store({ ...c, auto });
    },
    [store],
  );

  const value = useMemo<LocalCopy>(
    () => ({
      supported,
      ready,
      config,
      permission,
      folderLabel,
      running,
      autoError,
      choose,
      forget,
      setAuto,
      run: async (opts) => {
        const outcome = await run(opts);
        if (opts.manual) await refreshFolder(configRef.current);
        return outcome;
      },
    }),
    [supported, ready, config, permission, folderLabel, running, autoError, choose, forget, setAuto, run, refreshFolder],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

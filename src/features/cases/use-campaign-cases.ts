"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadClient } from "@/lib/supabase/lazy-client";
import { fetchCampaignCases, type CampaignCases } from "./fetch-campaign-cases";

// Dossiers de l'arbre : ceux que le serveur a déjà chargés (campagne ouverte
// par défaut), plus les autres campagnes, lues depuis le navigateur quand on
// les ouvre (voir loadMissing).
export function useCampaignCases(
  initialData: Record<string, CampaignCases>,
  selectedId: string | undefined,
) {
  const [extra, setExtra] = useState<Record<string, CampaignCases>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  // Campagne du dossier ouvert quand elle n'est pas encore chargée
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const loaded = useRef(new Set<string>());
  const lookedUp = useRef(new Set<string>());

  const load = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    try {
      const data = await fetchCampaignCases(await loadClient(), id);
      loaded.current.add(id);
      setExtra((e) => ({ ...e, [id]: data }));
      setErrors((e) => (e[id] ? { ...e, [id]: false } : e));
    } catch {
      setErrors((e) => ({ ...e, [id]: true }));
    } finally {
      inflight.current.delete(id);
    }
  }, []);

  const { cases, caseGroups } = useMemo(() => {
    const all = [...Object.values(initialData), ...Object.values(extra)];
    return {
      cases: all.flatMap((d) => d.cases),
      caseGroups: all.flatMap((d) => d.caseGroups),
    };
  }, [initialData, extra]);

  // Après un router.refresh(), les campagnes déjà chargées sont relues
  useEffect(() => {
    for (const id of loaded.current) void load(id);
  }, [initialData, load]);

  // Dossier ouvert dont la campagne n'est pas chargée (lien direct) : on
  // cherche sa campagne pour la charger et l'ouvrir
  useEffect(() => {
    if (!selectedId || cases.some((c) => c.id === selectedId)) return;
    if (lookedUp.current.has(selectedId)) return;
    lookedUp.current.add(selectedId);
    void (async () => {
      const supabase = await loadClient();
      const { data } = await supabase
        .from("cases")
        .select("campaign_id")
        .eq("id", selectedId)
        .maybeSingle();
      if (data?.campaign_id) setSelectedCampaignId(data.campaign_id as string);
    })();
  }, [selectedId, cases]);

  // Campagnes ouvertes à l'écran : charge celles qui manquent, sauf en échec
  // (voir retry). Change d'identité à chaque chargement ou échec, pour que
  // l'appelant le rappelle.
  const loadMissing = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        if (!(id in initialData) && !(id in extra) && !errors[id]) void load(id);
      }
    },
    [initialData, extra, errors, load],
  );

  return {
    cases,
    caseGroups,
    selectedCampaignId,
    loadMissing,
    isLoaded: (id: string) => id in initialData || id in extra,
    failed: (id: string) => Boolean(errors[id]),
    // Efface l'échec : la campagne, toujours ouverte, est rechargée
    retry: (id: string) => setErrors((e) => ({ ...e, [id]: false })),
  };
}

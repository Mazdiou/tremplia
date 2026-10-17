"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PILL_TONE_CLASSES } from "@/components/page-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  STATUS_SUFFIXES,
  educationRank,
  labelOf,
} from "@/features/cases/labels";
import { displayName, fullName } from "@/lib/names";
import { formatDA } from "@/lib/money";
import { UnreadBadge } from "@/features/messages/components/unread-badge";
import { cn } from "@/lib/utils";
import { TREE_WIDTH, useUiPrefs } from "@/lib/ui-prefs";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCampaignCases,
  type CampaignCases,
  type TreeCase,
} from "@/features/cases/fetch-campaign-cases";
import {
  buildCampaignBranches,
  linkFilter,
  matchesPayment,
  NO_FILTERS,
  type TreeGroup,
} from "@/features/cases/tree";
import {
  stageFilterOptions,
  stageKey,
  type CampaignStage,
} from "@/features/stages/stages";
import { isCasesIndex } from "./cases-content";
import { BulkActionsBar } from "./bulk-actions-bar";
import { TreeSearchResults } from "./tree-search-results";
import { CampaignMenu, GroupActions, InlineNameInput, groupApi } from "./tree-actions";
import { BRAND } from "@/config/brand";
import { plural } from "@/lib/plural";

type TreeCampaign = { id: string; name: string; status: string };

export type TreeMember = {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

const collator = new Intl.Collator("fr", { sensitivity: "base" });

function byName(a: TreeCase, b: TreeCase) {
  return (
    collator.compare(a.last_name, b.last_name) ||
    collator.compare(a.first_name, b.first_name)
  );
}

function byLevel(a: TreeCase, b: TreeCase) {
  return (
    educationRank(a.education_level) - educationRank(b.education_level) ||
    byName(a, b)
  );
}

// Réglages d'affichage (bouton à côté du nom de l'application)
const DISPLAY_OPTIONS = [
  { key: "showLevel", label: "Afficher le niveau d'études" },
  { key: "showPayments", label: "Afficher le reste à payer" },
  { key: "showStage", label: "Afficher l'étape" },
  { key: "showClosed", label: "Afficher clos et abandonnés" },
  { key: "showArchived", label: "Afficher les campagnes archivées" },
] as const;
type DisplayOption = (typeof DISPLAY_OPTIONS)[number]["key"];

const selectClass =
  "h-8 min-w-0 flex-1 rounded-lg border bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function CaseTree({
  campaigns,
  groups,
  stages,
  initialData,
  members,
  currentUserId,
  unread,
  isOwner,
  readOnly = false,
}: {
  campaigns: TreeCampaign[];
  groups: TreeGroup[];
  // Étapes de toutes les campagnes de l'agence
  stages: CampaignStage[];
  // Dossiers déjà chargés par le serveur (campagne ouverte par défaut)
  initialData: Record<string, CampaignCases>;
  members: TreeMember[];
  currentUserId: string;
  // Messages du candidat non lus, par dossier
  unread: Record<string, number>;
  // Le patron peut aussi changer le responsable de plusieurs dossiers
  isOwner: boolean;
  // Abonnement expiré : rien à créer (la base refuserait de toute façon)
  readOnly?: boolean;
}) {
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
  const router = useRouter();
  const pathname = usePathname();
  const [prefs, setPrefs] = useUiPrefs();

  const [query, setQuery] = useState("");
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Saisie en cours d'un nouveau groupe (id de campagne) ou d'un renommage
  const [addingGroupFor, setAddingGroupFor] = useState<string | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  // Mode sélection (actions groupées) et dossiers cochés
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  function exitSelection() {
    setSelecting(false);
    setChecked(new Set());
  }

  function toggleChecked(ids: string[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  // Raccourcis (Cmd sur Mac) : Ctrl+K pour chercher, Ctrl+B pour replier /
  // ouvrir le panneau, comme dans VS Code
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPrefs((p) => (p.collapsed ? { collapsed: false } : p));
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setPrefs((p) => ({ collapsed: !p.collapsed }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPrefs]);

  // Arrivée par un lien du tableau de bord (/cases?filtre=…&campagne=…) ou
  // d'une étape de campagne (/cases?etape=…&campagne=…) : filtres appliqués,
  // campagne(s) ouverte(s), puis adresse nettoyée
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedStage = stages.find((s) => s.id === params.get("etape"));
    const filter = linkFilter(
      params.get("filtre"),
      linkedStage ? stageKey(linkedStage.name) : null,
    );
    if (!filter) return;
    const only = params.get("campagne");
    const toOpen = campaigns.filter((c) => c.status === "active" && (!only || c.id === only));
    // Branches de ces campagnes : repliage oublié, celles qui ont des
    // résultats s'ouvrent (voir branchOpen)
    const prefixes = toOpen.map((c) => `${c.id}:`);
    setPrefs((p) => ({
      ...filter,
      collapsed: false,
      open: {
        ...Object.fromEntries(
          Object.entries(p.open).filter(([k]) => !prefixes.some((x) => k.startsWith(x))),
        ),
        ...Object.fromEntries(toOpen.map((c) => [c.id, true])),
      },
    }));
    router.replace(pathname, { scroll: false });
  }, [campaigns, stages, pathname, router, setPrefs]);

  const width = dragWidth ?? prefs.width;

  // --- Autres campagnes : chargées à l'ouverture (ou pendant une recherche) ---
  const [extra, setExtra] = useState<Record<string, CampaignCases>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const inflight = useRef(new Set<string>());
  const loaded = useRef(new Set<string>());
  const lookedUp = useRef(new Set<string>());

  const load = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    try {
      const data = await fetchCampaignCases(createClient(), id);
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
  const selectedCase = cases.find((c) => c.id === selectedId);

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
      const { data } = await createClient()
        .from("cases")
        .select("campaign_id")
        .eq("id", selectedId)
        .maybeSingle();
      if (data?.campaign_id) setSelectedCampaignId(data.campaign_id as string);
    })();
  }, [selectedId, cases]);

  // --- Recherche globale (serveur) et filtres (sur les dossiers chargés) ---
  const searching = query.trim() !== "";
  const filtersActive = Boolean(
    prefs.level || prefs.responsible || prefs.mine || prefs.payment || prefs.stage,
  );

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  // Campagnes archivées masquées, sauf réglage ou dossier ouvert dedans
  const shownCampaigns = campaigns.filter(
    (c) =>
      c.status === "active" ||
      prefs.showArchived ||
      selectedCase?.campaign_id === c.id ||
      selectedCampaignId === c.id,
  );

  function isCampOpen(camp: TreeCampaign) {
    return (
      prefs.open[camp.id] ??
      ((activeCampaigns.length === 1 && activeCampaigns[0].id === camp.id) ||
        selectedCase?.campaign_id === camp.id ||
        selectedCampaignId === camp.id)
    );
  }
  const isLoaded = (id: string) => id in initialData || id in extra;
  const wantedKey = shownCampaigns
    .filter((c) => !(c.id in initialData) && isCampOpen(c))
    .map((c) => c.id)
    .join(",");

  useEffect(() => {
    const ids = wantedKey
      .split(",")
      .filter((id) => id && !(id in extra) && !errors[id]);
    if (ids.length === 0) return;
    const t = setTimeout(() => ids.forEach((id) => void load(id)), 0);
    return () => clearTimeout(t);
  }, [wantedKey, extra, errors, load]);

  // Nom de l'étape de chaque dossier, par identifiant d'étape
  const stageNames = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);
  const stageOptions = stageFilterOptions(
    stages,
    shownCampaigns.map((c) => c.id),
  );

  function matches(c: TreeCase) {
    if (prefs.level && c.education_level !== prefs.level) return false;
    if (prefs.stage) {
      const name = c.stage_id ? stageNames.get(c.stage_id) : undefined;
      if (!name || stageKey(name) !== prefs.stage) return false;
    }
    if (prefs.responsible && c.assigned_to !== prefs.responsible) return false;
    if (prefs.mine && c.assigned_to !== currentUserId) return false;
    return matchesPayment(c, prefs.payment);
  }

  const found = cases.filter(matches);
  const allCount = cases.filter((c) => c.status === "active").length;
  const mineCount = cases.filter(
    (c) => c.status === "active" && c.assigned_to === currentUserId,
  ).length;
  const resultCount = found.filter((c) => c.status === "active").length;
  // Le dossier ouvert reste visible même s'il est clos. Une action groupée
  // ne porte que sur les dossiers cochés encore affichés (filtres, clos).
  const shownCase = (c: TreeCase) =>
    prefs.showClosed || c.status === "active" || c.id === selectedId;
  const selectedCases = found.filter((c) => checked.has(c.id) && shownCase(c));
  // Les compteurs ne portent que sur les dossiers chargés : on ne les montre
  // que lorsque toutes les campagnes actives le sont (sinon « 0 » trompeur).
  const allLoaded = activeCampaigns.every((c) => isLoaded(c.id));

  async function afterGroupChange(failure: string | null) {
    if (failure) return failure;
    setAddingGroupFor(null);
    setRenamingGroup(null);
    router.refresh();
    return null;
  }

  // Responsables proposés : membres actifs, et inactifs seulement s'ils ont des dossiers
  const withCases = new Set(cases.map((c) => c.assigned_to));
  const responsibles = members.filter((m) => m.is_active || withCases.has(m.id));

  function reset() {
    setQuery("");
    setPrefs(NO_FILTERS);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = prefs.width;
    let last = startWidth;
    function onMove(ev: PointerEvent) {
      last = Math.min(TREE_WIDTH.max, Math.max(TREE_WIDTH.min, startWidth + ev.clientX - startX));
      setDragWidth(last);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      setPrefs({ width: last });
      setDragWidth(null);
    }
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Le repli ne concerne que l'ordinateur : sur téléphone, l'arbre occupe
  // tout l'écran de l'accueil des dossiers et n'a rien à replier.
  const collapsed = prefs.collapsed;

  return (
    <>
      {/* Panneau replié : une fine barre d'icônes */}
      {collapsed && (
        <aside className="hidden h-full w-12 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2 md:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPrefs({ collapsed: false })}
            aria-label="Ouvrir le panneau des dossiers"
            title="Ouvrir le panneau (Ctrl+B)"
          >
            <PanelLeftOpen />
          </Button>
          {!readOnly && (
            <Link
              href="/cases/new"
              aria-label="Nouveau dossier"
              title="Nouveau dossier"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Plus />
            </Link>
          )}
        </aside>
      )}

      <aside
        style={{ "--tree-w": `${width}px` } as React.CSSProperties}
        className={cn(
          "relative flex h-full w-full shrink-0 flex-col bg-sidebar md:w-(--tree-w)",
          !isCasesIndex(pathname) && "max-md:hidden",
          collapsed && "md:hidden",
        )}
      >
        {/* En-tête */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-3">
          <Link
            href="/cases"
            className="truncate text-base font-semibold tracking-tight"
          >
            {BRAND.name}
          </Link>
          <kbd className="ml-auto mr-1 text-[11px] text-muted-foreground max-md:hidden">
            Ctrl B
          </kbd>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              aria-pressed={selecting}
              aria-label="Sélectionner des dossiers"
              title="Sélectionner des dossiers (étape, responsable)"
              className={cn(selecting && "bg-accent text-accent-foreground")}
            >
              <CheckSquare />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen}
            aria-label="Réglages d'affichage"
            title="Réglages d'affichage"
          >
            <SlidersHorizontal />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPrefs({ collapsed: true })}
            aria-label="Replier le panneau"
            title="Replier le panneau (Ctrl+B)"
            className="max-md:hidden"
          >
            <PanelLeftClose />
          </Button>
        </div>

        {settingsOpen && (
          <div className="absolute top-12 right-3 left-3 z-20 space-y-2 rounded-xl border bg-popover p-3 text-sm shadow-lg">
            {DISPLAY_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) =>
                    setPrefs({ [key]: e.target.checked } as Partial<Record<DisplayOption, boolean>>)
                  }
                />
                {label}
              </label>
            ))}
            <label className="flex items-center justify-between gap-2">
              Trier par
              <select
                value={prefs.sortBy}
                onChange={(e) =>
                  setPrefs({ sortBy: e.target.value as "name" | "level" })
                }
                className={cn(selectClass, "max-w-36 flex-none")}
              >
                <option value="name">Nom</option>
                <option value="level">Niveau d&apos;études</option>
              </select>
            </label>
          </div>
        )}

        {/* Recherche */}
        <div className="px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Rechercher un candidat"
              aria-label="Rechercher un candidat dans toutes les campagnes"
              className="h-10 w-full rounded-lg border bg-card pr-16 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {!query && (
              <kbd className="pointer-events-none absolute top-2.5 right-2.5 rounded-md border px-1.5 text-[11px] text-muted-foreground max-md:hidden">
                Ctrl K
              </kbd>
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Effacer la recherche"
                className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-2">
          <div
            role="group"
            aria-label="Portée des dossiers"
            className="mb-1 flex w-full rounded-xl bg-muted p-[3px]"
          >
            {[
              { mine: false, label: "Tous", n: allCount },
              { mine: true, label: "Mes dossiers", n: mineCount },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={prefs.mine === opt.mine}
                onClick={() => setPrefs({ mine: opt.mine, responsible: "" })}
                className={cn(
                  "h-8 flex-1 rounded-[9px] text-sm transition-colors",
                  prefs.mine === opt.mine
                    ? "bg-card font-medium text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}{" "}
                {allLoaded && <span className="tabular-nums">{opt.n}</span>}
              </button>
            ))}
          </div>
          <select
            value={prefs.level}
            onChange={(e) => setPrefs({ level: e.target.value })}
            aria-label="Filtrer par niveau d'études"
            className={selectClass}
          >
            <option value="">Tous niveaux</option>
            {EDUCATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {EDUCATION_LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
          <select
            value={prefs.payment}
            onChange={(e) =>
              setPrefs({ payment: e.target.value as typeof prefs.payment })
            }
            aria-label="Filtrer par paiement"
            className={selectClass}
          >
            <option value="">Tous paiements</option>
            <option value="due">Reste à payer</option>
            <option value="paid">Soldés</option>
            <option value="unset">Montant à fixer</option>
          </select>
          {stageOptions.length > 0 && (
            <select
              value={prefs.stage}
              onChange={(e) => setPrefs({ stage: e.target.value })}
              aria-label="Filtrer par étape"
              className={cn(selectClass, "basis-full")}
            >
              <option value="">Toutes étapes</option>
              {stageOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
              {prefs.stage && !stageOptions.some((o) => o.key === prefs.stage) && (
                <option value={prefs.stage}>{prefs.stage}</option>
              )}
            </select>
          )}
          {!prefs.mine && (
            <select
              value={prefs.responsible}
              onChange={(e) => setPrefs({ responsible: e.target.value })}
              aria-label="Filtrer par responsable"
              className={cn(selectClass, "basis-full")}
            >
              <option value="">Tous responsables</option>
              {responsibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m.first_name, m.last_name)}
                  {m.is_active ? "" : " (désactivé)"}
                </option>
              ))}
            </select>
          )}
        </div>

        {filtersActive && !searching && (
          <div className="flex items-center justify-between border-y bg-muted/50 px-3 py-1.5 text-xs">
            <span aria-live="polite">
              {plural(resultCount, "dossier actif", "dossiers actifs")} · filtres actifs
            </span>
            <button
              type="button"
              onClick={reset}
              className="font-medium underline-offset-2 hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* Arbre, ou résultats de la recherche globale */}
        <nav
          aria-label="Dossiers"
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {searching ? (
            <TreeSearchResults
              query={query}
              selectedId={selectedId}
              showLevel={prefs.showLevel}
            />
          ) : (
            <>
              {shownCampaigns.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Aucune campagne active.
                </p>
              )}
              {filtersActive && found.length === 0 && cases.length > 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Aucun dossier ne correspond. Modifiez ou réinitialisez les filtres.
                </p>
              )}

              {shownCampaigns.map((camp) => {
                const campCases = found.filter((c) => c.campaign_id === camp.id);
                const campOpen = isCampOpen(camp);
                const campActive = camp.status === "active";

                return (
                  <div key={camp.id}>
                    <div className="flex items-center pr-2 hover:bg-muted/60">
                      <button
                        type="button"
                        aria-expanded={campOpen}
                        onClick={() =>
                          setPrefs((p) => ({
                            open: { ...p.open, [camp.id]: !campOpen },
                          }))
                        }
                        className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                      >
                        {campOpen ? (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{camp.name}</span>
                        {!campActive && (
                          <span className="shrink-0 normal-case">(archivée)</span>
                        )}
                      </button>
                      <CampaignMenu
                        campaignId={camp.id}
                        campaignName={camp.name}
                        active={campActive && !readOnly}
                        onAddGroup={() => {
                          setPrefs((p) => ({ open: { ...p.open, [camp.id]: true } }));
                          setAddingGroupFor(camp.id);
                        }}
                      />
                    </div>

                    {addingGroupFor === camp.id && (
                      <InlineNameInput
                        label="Nom du nouveau groupe"
                        onCancel={() => setAddingGroupFor(null)}
                        onSubmit={async (name) =>
                          afterGroupChange(await groupApi.create(camp.id, name))
                        }
                      />
                    )}

                    {campOpen && !isLoaded(camp.id) && (
                      <div className="py-1 pr-3 pl-9 text-sm text-muted-foreground">
                        {errors[camp.id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              setErrors((e) => ({ ...e, [camp.id]: false }))
                            }
                            className="underline-offset-2 hover:underline"
                          >
                            Chargement impossible. Réessayer
                          </button>
                        ) : (
                          "Chargement…"
                        )}
                      </div>
                    )}

                    {campOpen &&
                      isLoaded(camp.id) &&
                      buildCampaignBranches(camp.id, groups, campCases, caseGroups).map(
                        (branch) => {
                          const key = branch.key;
                          const groupId = branch.groupId;
                          const count = branch.cases.filter(
                            (c) => c.status === "active",
                          ).length;
                          // Ouverte par défaut si elle contient le dossier ouvert,
                          // ou des résultats quand des filtres sont actifs
                          const branchOpen =
                            prefs.open[key] ??
                            (branch.cases.some((c) => c.id === selectedId) ||
                              (filtersActive && count > 0));
                          const visible = branch.cases
                            .filter(shownCase)
                            .sort(prefs.sortBy === "level" ? byLevel : byName);
                          const visibleIds = visible.map((c) => c.id);
                          const checkedCount = visibleIds.filter((id) => checked.has(id)).length;

                          if (groupId && renamingGroup === groupId) {
                            return (
                              <InlineNameInput
                                key={key}
                                label={`Nouveau nom du groupe ${branch.label}`}
                                initial={branch.label}
                                onCancel={() => setRenamingGroup(null)}
                                onSubmit={async (name) =>
                                  afterGroupChange(
                                    await groupApi.rename(camp.id, groupId, name),
                                  )
                                }
                              />
                            );
                          }

                          return (
                            <div key={key}>
                              <div className="group flex items-center pr-2 hover:bg-muted/60">
                                {selecting && visible.length > 0 && (
                                  <BranchCheckbox
                                    label={`Cocher tous les dossiers de ${branch.label}`}
                                    checked={checkedCount === visible.length}
                                    indeterminate={checkedCount > 0 && checkedCount < visible.length}
                                    onChange={(on) => toggleChecked(visibleIds, on)}
                                  />
                                )}
                                <button
                                  type="button"
                                  aria-expanded={branchOpen}
                                  onClick={() =>
                                    setPrefs((p) => ({
                                      open: { ...p.open, [key]: !branchOpen },
                                    }))
                                  }
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 pl-4 text-left text-sm font-medium",
                                    selecting && visible.length > 0 && "pl-1",
                                    groupId === null && "text-muted-foreground",
                                  )}
                                >
                                  {branchOpen ? (
                                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{branch.label}</span>
                                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                    {count}
                                  </span>
                                </button>
                                {groupId && campActive && !readOnly && !selecting && (
                                  <GroupActions
                                    campaignId={camp.id}
                                    groupId={groupId}
                                    groupName={branch.label}
                                    onRename={() => setRenamingGroup(groupId)}
                                    className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                                  />
                                )}
                              </div>

                              {branchOpen &&
                                visible.map((c) => {
                                  const isSelected = c.id === selectedId;
                                  const suffix = STATUS_SUFFIXES[c.status];
                                  const rowClass = cn(
                                    "mx-3 flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm hover:bg-muted/60",
                                    c.status !== "active" && "text-muted-foreground",
                                  );
                                  const content = (
                                    <>
                                      <span className="truncate">
                                        {displayName(c.first_name, c.last_name)}
                                      </span>
                                      {suffix && (
                                        <span className="shrink-0 text-xs">
                                          ({suffix})
                                        </span>
                                      )}
                                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                        {(unread[c.id] ?? 0) > 0 && (
                                          <UnreadBadge count={unread[c.id]} />
                                        )}
                                        {prefs.showPayments &&
                                          (c.remaining_amount ?? 0) > 0 && (
                                            <span className={cn("rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums", PILL_TONE_CLASSES.warn)}>
                                              <span className="sr-only">Reste à payer : </span>
                                              {formatDA(c.remaining_amount ?? 0)}
                                            </span>
                                          )}
                                        {prefs.showStage && c.stage_id && stageNames.has(c.stage_id) && (
                                          <span className="max-w-28 truncate text-xs text-muted-foreground">
                                            <span className="sr-only">Étape : </span>
                                            {stageNames.get(c.stage_id)}
                                          </span>
                                        )}
                                        {prefs.showLevel && (
                                          <span className="text-xs text-muted-foreground">
                                            {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
                                          </span>
                                        )}
                                      </span>
                                    </>
                                  );
                                  // Mode sélection : la ligne coche le dossier au lieu de l'ouvrir
                                  if (selecting) {
                                    return (
                                      <label key={c.id} className={cn(rowClass, "cursor-pointer pl-3")}>
                                        <input
                                          type="checkbox"
                                          checked={checked.has(c.id)}
                                          onChange={(e) => toggleChecked([c.id], e.target.checked)}
                                          className="size-4 shrink-0 accent-primary"
                                        />
                                        {content}
                                      </label>
                                    );
                                  }
                                  return (
                                    <Link
                                      key={c.id}
                                      href={`/cases/${c.id}`}
                                      aria-current={isSelected ? "page" : undefined}
                                      className={cn(
                                        rowClass,
                                        isSelected && "bg-accent font-medium text-accent-foreground",
                                      )}
                                    >
                                      {content}
                                    </Link>
                                  );
                                })}
                            </div>
                          );
                        },
                      )}
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* Pied : actions groupées en mode sélection, sinon nouveau dossier */}
        {selecting && !readOnly ? (
          <BulkActionsBar
            selected={selectedCases}
            stages={stages}
            members={members}
            isOwner={isOwner}
            onClear={() => setChecked(new Set())}
            onExit={exitSelection}
          />
        ) : !readOnly && (
        <div className="p-4">
          <Link
            href={
              selectedCase
                ? `/cases/new?campaign=${selectedCase.campaign_id}`
                : "/cases/new"
            }
            className={cn(buttonVariants(), "w-full")}
          >
            <Plus /> Nouveau dossier
          </Link>
        </div>
        )}
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner le panneau"
        aria-valuenow={width}
        aria-valuemin={TREE_WIDTH.min}
        aria-valuemax={TREE_WIDTH.max}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPrefs({ width: width - 16 });
          if (e.key === "ArrowRight") setPrefs({ width: width + 16 });
        }}
        className={cn(
          "hidden w-px shrink-0 cursor-col-resize bg-border outline-none transition-colors hover:w-0.5 hover:bg-primary/40 focus-visible:w-0.5 focus-visible:bg-ring",
          !collapsed && "md:block",
        )}
      />
    </>
  );
}

// Case « tout cocher » d'un groupe : cochée, vide, ou à moitié quand une
// partie seulement de ses dossiers est cochée
function BranchCheckbox({
  label,
  checked,
  indeterminate,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="ml-3 size-4 shrink-0 accent-primary"
    />
  );
}

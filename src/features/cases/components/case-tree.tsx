"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  CheckSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiPrefs } from "@/lib/ui-prefs";
import { NEW_CASE_LINK_PROPS, NEW_CASE_TITLE } from "../new-case-link";
import type { CampaignCases, TreeCase } from "@/features/cases/fetch-campaign-cases";
import {
  buildCampaignBranches,
  linkFilter,
  matchesPayment,
  NO_FILTERS,
  treeCaseOrder,
  type TreeGroup,
} from "@/features/cases/tree";
import { useCampaignCases } from "@/features/cases/use-campaign-cases";
import {
  stageFilterOptions,
  stageKey,
  type CampaignStage,
} from "@/features/stages/stages";
import { isCasesIndex } from "./cases-content";
import { BulkActionsBar } from "./bulk-actions-bar";
import { TreeSearchResults } from "./tree-search-results";
import { CampaignMenu, InlineNameInput, groupApi } from "./tree-actions";
import { CampaignHeader, TreeBranch } from "./tree-branch";
import { TreeDisplaySettings, TreeFilters, TreeSearchBox } from "./tree-filters";
import { useTreeWidth } from "./tree-resize";
import { BRAND } from "@/config/brand";
import { SignupsTreeLink } from "@/features/signup/components/signups-tree-link";
import { plural } from "@/lib/plural";

type TreeCampaign = { id: string; name: string; status: string };

export type TreeMember = {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

export function CaseTree({
  campaigns,
  groups,
  stages,
  initialData,
  members,
  currentUserId,
  unread,
  overdue,
  isOwner,
  readOnly = false,
  signups = null,
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
  // Tâches en retard, par dossier
  overdue: Record<string, number>;
  // Le patron peut aussi changer le responsable de plusieurs dossiers
  isOwner: boolean;
  // Abonnement expiré : rien à créer (la base refuserait de toute façon)
  readOnly?: boolean;
  // Inscription en ligne : demandes en attente et page ouverte ou non ;
  // null : ligne non affichée (employé, page jamais servie)
  signups?: { count: number; open: boolean } | null;
}) {
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
  const router = useRouter();
  const pathname = usePathname();
  const [prefs, setPrefs] = useUiPrefs();

  const [query, setQuery] = useState("");
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

  const { width, separator } = useTreeWidth();

  const { cases, caseGroups, selectedCampaignId, loadMissing, isLoaded, failed, retry } =
    useCampaignCases(initialData, selectedId);
  const selectedCase = cases.find((c) => c.id === selectedId);

  // --- Recherche globale (serveur) et filtres (sur les dossiers chargés) ---
  const searching = query.trim() !== "";
  const filtersActive = Boolean(
    prefs.level || prefs.responsible || prefs.mine || prefs.payment || prefs.stage || prefs.overdue,
  );

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  // Campagnes archivées masquées, sauf réglage ou dossier ouvert dedans
  const visibleCampaigns = campaigns.filter(
    (c) =>
      c.status === "active" ||
      prefs.showArchived ||
      selectedCase?.campaign_id === c.id ||
      selectedCampaignId === c.id,
  );
  // Épinglées en tête, par ordre alphabétique ; les autres gardent leur ordre
  const pinned = new Set(prefs.pinned);
  const shownCampaigns = [
    ...visibleCampaigns
      .filter((c) => pinned.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" })),
    ...visibleCampaigns.filter((c) => !pinned.has(c.id)),
  ];

  function isCampOpen(camp: TreeCampaign) {
    return (
      prefs.open[camp.id] ??
      ((activeCampaigns.length === 1 && activeCampaigns[0].id === camp.id) ||
        selectedCase?.campaign_id === camp.id ||
        selectedCampaignId === camp.id)
    );
  }
  // Campagnes ouvertes : chargées à l'ouverture
  const wantedKey = shownCampaigns
    .filter(isCampOpen)
    .map((c) => c.id)
    .join(",");
  useEffect(() => {
    const t = setTimeout(() => loadMissing(wantedKey.split(",").filter(Boolean)), 0);
    return () => clearTimeout(t);
  }, [wantedKey, loadMissing]);

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
    if (prefs.overdue && !overdue[c.id]) return false;
    return matchesPayment(c, prefs.payment);
  }

  // Une campagne archivée dépliée puis masquée garde ses dossiers en mémoire :
  // on ne garde que ceux des campagnes affichées
  const shownIds = new Set(shownCampaigns.map((c) => c.id));
  const shownCases = cases.filter((c) => shownIds.has(c.campaign_id));
  const found = shownCases.filter(matches);
  // « Tous » et « Mes dossiers » : dossiers actifs des campagnes actives
  // seulement, qu'une campagne archivée soit dépliée ou non
  const activeIds = new Set(activeCampaigns.map((c) => c.id));
  const activeCases = cases.filter((c) => c.status === "active" && activeIds.has(c.campaign_id));
  const allCount = activeCases.length;
  const mineCount = activeCases.filter((c) => c.assigned_to === currentUserId).length;
  const resultCount = found.filter((c) => c.status === "active").length;
  // Le dossier ouvert reste visible même s'il est clos. Une action groupée
  // ne porte que sur les dossiers cochés encore affichés (filtres, clos).
  const shownCase = (c: TreeCase) =>
    prefs.showClosed || c.status === "active" || c.id === selectedId;
  const selectedCases = found.filter((c) => checked.has(c.id) && shownCase(c));
  const order = treeCaseOrder(prefs.sortBy);
  const rowShow = {
    level: prefs.showLevel,
    payments: prefs.showPayments,
    stage: prefs.showStage,
  };
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
              title={NEW_CASE_TITLE}
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
          "@container relative flex h-full w-full shrink-0 flex-col bg-sidebar md:w-(--tree-w)",
          !isCasesIndex(pathname) && "max-md:hidden",
          collapsed && "md:hidden",
        )}
      >
        {/* Téléphone, accueil des dossiers : l'arbre est seul à l'écran, ce
            titre de page est lu par les lecteurs d'écran (sur ordinateur,
            celui du contenu suffit) */}
        <h1 className="sr-only md:hidden">Dossiers</h1>
        {/* En-tête */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-3">
          <Link
            href="/cases"
            className="truncate font-brand text-base font-bold tracking-tight"
          >
            {BRAND.name}
          </Link>
          <kbd className="ml-auto mr-1 whitespace-nowrap text-[0.6875rem] text-muted-foreground max-md:hidden @max-[16rem]:hidden">
            Ctrl B
          </kbd>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              aria-pressed={selecting}
              aria-label="Sélectionner des dossiers"
              title="Sélectionner des dossiers"
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

        {settingsOpen && <TreeDisplaySettings />}

        <TreeSearchBox query={query} onChange={setQuery} inputRef={searchRef} />

        <TreeFilters
          counts={allLoaded ? { all: allCount, mine: mineCount } : null}
          stageOptions={stageOptions}
          responsibles={responsibles}
          hasOverdue={Object.keys(overdue).length > 0}
        />

        {filtersActive && !searching && (
          <div className="flex items-center justify-between border-y bg-muted/50 px-3 py-1.5 text-xs">
            <span aria-live="polite">
              {plural(resultCount, "dossier actif", "dossiers actifs")} avec les filtres
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
              {signups && <SignupsTreeLink count={signups.count} open={signups.open} />}
              {shownCampaigns.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Aucune campagne active.
                </p>
              )}
              {filtersActive && found.length === 0 && shownCases.length > 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Aucun dossier ne correspond. Modifiez ou réinitialisez les filtres.
                </p>
              )}

              {shownCampaigns.map((camp) => {
                const campCases = found.filter((c) => c.campaign_id === camp.id);
                const campOpen = isCampOpen(camp);
                const campActive = camp.status === "active";
                const campPinned = pinned.has(camp.id);

                return (
                  <div key={camp.id}>
                    <CampaignHeader
                      name={camp.name}
                      archived={!campActive}
                      pinned={campPinned}
                      open={campOpen}
                      onToggle={() =>
                        setPrefs((p) => ({ open: { ...p.open, [camp.id]: !campOpen } }))
                      }
                    >
                      <CampaignMenu
                        campaignId={camp.id}
                        campaignName={camp.name}
                        active={campActive && !readOnly}
                        pinned={campPinned}
                        onTogglePin={() =>
                          setPrefs((p) => ({
                            pinned: campPinned
                              ? p.pinned.filter((id) => id !== camp.id)
                              : [...p.pinned, camp.id],
                          }))
                        }
                        onAddGroup={() => {
                          setPrefs((p) => ({ open: { ...p.open, [camp.id]: true } }));
                          setAddingGroupFor(camp.id);
                        }}
                      />
                    </CampaignHeader>

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
                        {failed(camp.id) ? (
                          <button
                            type="button"
                            onClick={() => retry(camp.id)}
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
                          const { key, groupId } = branch;
                          const count = branch.cases.filter(
                            (c) => c.status === "active",
                          ).length;
                          // Ouverte par défaut si elle contient le dossier ouvert,
                          // ou des résultats quand des filtres sont actifs
                          const branchOpen =
                            prefs.open[key] ??
                            (branch.cases.some((c) => c.id === selectedId) ||
                              (filtersActive && count > 0));

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
                            <TreeBranch
                              key={key}
                              label={branch.label}
                              count={count}
                              cases={branch.cases.filter(shownCase).sort(order)}
                              open={branchOpen}
                              onToggle={() =>
                                setPrefs((p) => ({ open: { ...p.open, [key]: !branchOpen } }))
                              }
                              muted={groupId === null}
                              actions={
                                groupId && campActive && !readOnly
                                  ? {
                                      campaignId: camp.id,
                                      groupId,
                                      onRename: () => setRenamingGroup(groupId),
                                    }
                                  : null
                              }
                              selectedId={selectedId}
                              selecting={selecting}
                              checked={checked}
                              onCheck={toggleChecked}
                              overdue={overdue}
                              unread={unread}
                              stageNames={stageNames}
                              show={rowShow}
                            />
                          );
                        },
                      )}

                    {/* Campagne encore vide : de quoi commencer */}
                    {campOpen &&
                      isLoaded(camp.id) &&
                      !filtersActive &&
                      !cases.some((c) => c.campaign_id === camp.id) && (
                        <div className="py-1.5 pr-3 pl-9 text-sm text-muted-foreground">
                          Aucun dossier pour l&apos;instant.
                          {campActive && !readOnly && (
                            <>
                              {" "}
                              <Link
                                href={`/cases/new?campaign=${camp.id}`}
                                className="font-medium text-link hover:underline"
                              >
                                Ajouter le premier
                              </Link>
                            </>
                          )}
                        </div>
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
            currentUserId={currentUserId}
            isOwner={isOwner}
            onClear={() => setChecked(new Set())}
            onExit={exitSelection}
          />
        ) : (
          !readOnly && (
            <div className="p-4">
              <Link
                href={
                  selectedCase
                    ? `/cases/new?campaign=${selectedCase.campaign_id}`
                    : "/cases/new"
                }
                className={cn(buttonVariants(), "w-full")}
                title={NEW_CASE_TITLE}
                {...NEW_CASE_LINK_PROPS}
              >
                <Plus /> Nouveau dossier
              </Link>
            </div>
          )
        )}
      </aside>

      {separator}
    </>
  );
}

import { useSyncExternalStore } from "react";

// Mémoire de l'interface (largeur, dossiers ouverts, réglages, filtres).
// Stockée dans localStorage, lue côté client seulement : le rendu serveur et
// l'hydratation utilisent les valeurs par défaut, puis React bascule sur les
// valeurs mémorisées sans écart d'hydratation. Aucune donnée sensible ici.

export const PAYMENT_FILTERS = ["", "due", "paid", "unset"] as const;
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number];

export type UiPrefs = {
  width: number;
  collapsed: boolean;
  open: Record<string, boolean>;
  showLevel: boolean;
  showClosed: boolean;
  showArchived: boolean;
  // Reste à payer affiché à côté du nom
  showPayments: boolean;
  // Étape du dossier affichée à côté du nom
  showStage: boolean;
  sortBy: "name" | "level";
  level: string;
  responsible: string;
  mine: boolean;
  // Filtre des paiements : reste à payer, soldés, montant à fixer
  payment: PaymentFilter;
  // Filtre d'étape : nom d'étape en minuscules (voir stageKey)
  stage: string;
  // Seulement les dossiers qui ont une tâche en retard
  overdue: boolean;
  // En-tête de la fiche d'un dossier : réduit à une ligne ou complet ;
  // « auto » (pas encore choisi) = réduit sur téléphone, complet ailleurs
  caseHeader: "auto" | "collapsed" | "expanded";
};

export const DEFAULT_PREFS: UiPrefs = {
  width: 288,
  collapsed: false,
  open: {},
  showLevel: false,
  showClosed: false,
  showArchived: false,
  showPayments: true,
  showStage: false,
  sortBy: "name",
  level: "",
  responsible: "",
  mine: false,
  payment: "",
  stage: "",
  overdue: false,
  caseHeader: "auto",
};

// Largeur du panneau des dossiers, en pixels
export const TREE_WIDTH = { min: 220, max: 520 } as const;

const KEY = "sf:ui";
const listeners = new Set<() => void>();
let cache: UiPrefs = DEFAULT_PREFS;
let loaded = false;

// Valeurs mémorisées par un ancien code ou modifiées à la main : tout ce qui
// est inattendu revient à la valeur par défaut.
export function sanitize(raw: unknown): UiPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<UiPrefs>;
  const d = DEFAULT_PREFS;
  return {
    width:
      Number.isFinite(r.width)
        ? Math.min(TREE_WIDTH.max, Math.max(TREE_WIDTH.min, r.width as number))
        : d.width,
    collapsed: r.collapsed === true,
    open: r.open && typeof r.open === "object" ? r.open : d.open,
    showLevel: r.showLevel === true,
    showClosed: r.showClosed === true,
    showArchived: r.showArchived === true,
    showPayments: r.showPayments !== false,
    showStage: r.showStage === true,
    sortBy: r.sortBy === "level" ? "level" : "name",
    level: typeof r.level === "string" ? r.level : "",
    responsible: typeof r.responsible === "string" ? r.responsible : "",
    mine: r.mine === true,
    payment: (PAYMENT_FILTERS as readonly unknown[]).includes(r.payment)
      ? (r.payment as PaymentFilter)
      : "",
    stage: typeof r.stage === "string" ? r.stage : "",
    overdue: r.overdue === true,
    caseHeader:
      r.caseHeader === "collapsed" || r.caseHeader === "expanded" ? r.caseHeader : "auto",
  };
}

function read(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  if (!loaded) {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) cache = sanitize(JSON.parse(raw));
    } catch {
      // stockage indisponible : on garde les valeurs par défaut
    }
  }
  return cache;
}

function setPrefs(
  patch: Partial<UiPrefs> | ((p: UiPrefs) => Partial<UiPrefs>),
) {
  const current = read();
  cache = sanitize({
    ...current,
    ...(typeof patch === "function" ? patch(current) : patch),
  });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Stockage indisponible : le réglage vaut pour cette visite seulement
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUiPrefs() {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
  return [prefs, setPrefs] as const;
}

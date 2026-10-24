import { z } from "zod";

// Widgets du tableau de bord. Chaque membre choisit ceux qu'il affiche, leur
// ordre et leur taille ; sans choix de sa part, il voit la disposition de
// l'agence (choisie par le patron), sinon DEFAULT_LAYOUT. Règles partagées
// entre le navigateur (mode « Personnaliser ») et le serveur.

export type WidgetSize = "half" | "full";

export type WidgetDef = {
  label: string;
  description: string;
  defaultSize: WidgetSize;
  // Droit nécessaire pour l'afficher (et le proposer)
  requires?: "owner" | "payments_view";
  // Le widget n'a de sens qu'avec une seule campagne affichée, ou plusieurs
  scope?: "single" | "several";
};

export const WIDGETS = {
  todo: {
    label: "À traiter",
    description: "Messages non lus et réponses des candidats qui attendent l'agence.",
    defaultSize: "full",
  },
  tasks: {
    label: "Mes tâches",
    description: "Vos tâches en retard, du jour et à venir.",
    defaultSize: "full",
  },
  stats: {
    label: "Chiffres clés",
    description: "Dossiers actifs, mes dossiers, ajouts de la semaine et candidats admis.",
    defaultSize: "full",
  },
  pipeline: {
    label: "Avancement par étape",
    description: "Dossiers actifs à chaque étape de la campagne.",
    defaultSize: "full",
    scope: "single",
  },
  campaigns: {
    label: "Campagnes",
    description: "Une carte par campagne active, avec sa prochaine échéance.",
    defaultSize: "full",
    scope: "several",
  },
  payments: {
    label: "Paiements",
    description: "Encaissé ce mois, reste à encaisser et plus gros restes à payer.",
    defaultSize: "full",
    requires: "payments_view",
  },
  deadlines: {
    label: "Échéances",
    description: "Prochaines dates de la campagne.",
    defaultSize: "half",
    scope: "single",
  },
  results: {
    label: "Réponses des établissements",
    description: "Formations acceptées, refusées ou en attente.",
    defaultSize: "half",
  },
  recent: {
    label: "Ajoutés récemment",
    description: "Les cinq derniers dossiers créés.",
    defaultSize: "half",
  },
  activity: {
    label: "Activité de l'équipe",
    description: "Ce que chaque membre a fait ces derniers jours.",
    defaultSize: "full",
    requires: "owner",
  },
} satisfies Record<string, WidgetDef>;

export type WidgetId = keyof typeof WIDGETS;

export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

export type LayoutItem = { id: WidgetId; size: WidgetSize };

export const DEFAULT_LAYOUT: LayoutItem[] = WIDGET_IDS.map((id) => ({
  id,
  size: WIDGETS[id].defaultSize,
}));

// Disposition envoyée par le navigateur : seulement des widgets connus,
// chacun une fois
export const layoutSchema = z
  .array(
    z.object({
      id: z.enum(WIDGET_IDS as [WidgetId, ...WidgetId[]]),
      size: z.enum(["half", "full"]),
    }),
  )
  .max(WIDGET_IDS.length)
  .refine((items) => new Set(items.map((i) => i.id)).size === items.length, "Widget en double");

export const saveLayoutSchema = z.object({
  // Vide : retour à la disposition de départ
  layout: layoutSchema.nullable(),
  // Patron : enregistre aussi la disposition de départ de l'agence
  forAgency: z.boolean().optional(),
});

// Disposition lue en base : les widgets inconnus (retirés depuis) ou en
// double sont ignorés au lieu de tout faire échouer
export function parseLayout(raw: unknown): LayoutItem[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const items: LayoutItem[] = [];
  for (const entry of raw) {
    const id = (entry as { id?: unknown })?.id;
    const size = (entry as { size?: unknown })?.size;
    if (typeof id !== "string" || !(id in WIDGETS) || seen.has(id)) continue;
    seen.add(id);
    items.push({ id: id as WidgetId, size: size === "half" ? "half" : "full" });
  }
  return items;
}

// Ce que le membre a le droit de voir
export function allowedWidget(
  id: WidgetId,
  rights: { isOwner: boolean; seesPayments: boolean },
): boolean {
  const req = (WIDGETS[id] as WidgetDef).requires;
  if (req === "owner") return rights.isOwner;
  if (req === "payments_view") return rights.seesPayments;
  return true;
}

// Widget utile avec le nombre de campagnes affichées
export function applicableWidget(id: WidgetId, campaignCount: number): boolean {
  const scope = (WIDGETS[id] as WidgetDef).scope;
  if (scope === "single") return campaignCount === 1;
  if (scope === "several") return campaignCount > 1;
  return true;
}

// Largeur réelle de chaque widget dans la grille à deux colonnes : un widget
// en demi-largeur resté seul sur sa ligne prend toute la largeur, pour ne
// jamais laisser de trou
export function arrangeRows<T extends { size: WidgetSize }>(items: T[]): (T & { wide: boolean })[] {
  const out: (T & { wide: boolean })[] = [];
  let waiting: (T & { wide: boolean }) | null = null;
  for (const item of items) {
    if (item.size === "half") {
      if (waiting) {
        out.push(waiting, { ...item, wide: false });
        waiting = null;
      } else {
        waiting = { ...item, wide: false };
      }
      continue;
    }
    if (waiting) {
      out.push({ ...waiting, wide: true });
      waiting = null;
    }
    out.push({ ...item, wide: true });
  }
  if (waiting) out.push({ ...waiting, wide: true });
  return out;
}

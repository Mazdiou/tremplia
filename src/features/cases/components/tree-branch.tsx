"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlarmClock, ChevronDown, ChevronRight } from "lucide-react";
import { PILL_TONE_CLASSES } from "@/components/page-ui";
import { EDUCATION_LEVEL_LABELS, STATUS_SUFFIXES, labelOf } from "@/features/cases/labels";
import type { TreeCase } from "@/features/cases/fetch-campaign-cases";
import { UnreadBadge } from "@/features/messages/components/unread-badge";
import { displayName } from "@/lib/names";
import { formatDA } from "@/lib/money";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { GroupActions } from "./tree-actions";

// En-tête d'une campagne : nom repliable, puis son menu (children)
export function CampaignHeader({
  name,
  archived,
  open,
  onToggle,
  children,
}: {
  name: string;
  archived: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center pr-2 hover:bg-muted/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{name}</span>
        {archived && <span className="shrink-0 normal-case">(archivée)</span>}
      </button>
      {children}
    </div>
  );
}

type RowShow = { level: boolean; payments: boolean; stage: boolean };

// Une branche d'une campagne (un groupe, ou « Non classés ») : en-tête
// repliable avec son compteur, puis ses dossiers. `cases` est déjà filtré et
// trié ; `count` compte les dossiers actifs de la branche.
export function TreeBranch({
  label,
  count,
  cases,
  open,
  onToggle,
  muted,
  actions,
  selectedId,
  selecting,
  checked,
  onCheck,
  overdue,
  unread,
  stageNames,
  show,
}: {
  label: string;
  count: number;
  cases: TreeCase[];
  open: boolean;
  onToggle: () => void;
  // « Non classés » : libellé grisé
  muted: boolean;
  // Boutons du groupe (renommer, supprimer), montrés au survol
  actions: { campaignId: string; groupId: string; onRename: () => void } | null;
  selectedId: string | undefined;
  selecting: boolean;
  checked: Set<string>;
  onCheck: (ids: string[], on: boolean) => void;
  overdue: Record<string, number>;
  unread: Record<string, number>;
  stageNames: Map<string, string>;
  show: RowShow;
}) {
  const ids = cases.map((c) => c.id);
  const checkedCount = ids.filter((id) => checked.has(id)).length;
  return (
    <div>
      <div className="group flex items-center pr-2 hover:bg-muted/60">
        {selecting &&
          (cases.length > 0 ? (
            <BranchCheckbox
              label={`Cocher tous les dossiers de ${label}`}
              checked={checkedCount === cases.length}
              indeterminate={checkedCount > 0 && checkedCount < cases.length}
              onChange={(on) => onCheck(ids, on)}
            />
          ) : (
            // Groupe vide : même retrait, les chevrons restent alignés
            <span aria-hidden className="ml-3 size-4 shrink-0" />
          ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 pl-4 text-left text-sm font-medium",
            selecting && "pl-1",
            muted && "text-muted-foreground",
          )}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{label}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
        </button>
        {actions && !selecting && (
          <GroupActions
            campaignId={actions.campaignId}
            groupId={actions.groupId}
            groupName={label}
            onRename={actions.onRename}
            className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          />
        )}
      </div>

      {open &&
        cases.map((c) => (
          <TreeCaseRow
            key={c.id}
            c={c}
            isSelected={c.id === selectedId}
            stageName={c.stage_id ? stageNames.get(c.stage_id) : undefined}
            overdue={overdue[c.id] ?? 0}
            unread={unread[c.id] ?? 0}
            show={show}
            selecting={selecting}
            checked={checked.has(c.id)}
            onCheck={(on) => onCheck([c.id], on)}
          />
        ))}
    </div>
  );
}

// Un dossier dans l'arbre : nom, puis pastilles (tâches en retard, messages
// non lus) et informations choisies dans les réglages d'affichage. En mode
// sélection, la ligne coche le dossier au lieu de l'ouvrir.
function TreeCaseRow({
  c,
  isSelected,
  stageName,
  overdue,
  unread,
  show,
  selecting,
  checked,
  onCheck,
}: {
  c: TreeCase;
  isSelected: boolean;
  // Nom de l'étape du dossier (affichée si le réglage est actif)
  stageName: string | undefined;
  overdue: number;
  unread: number;
  show: RowShow;
  selecting: boolean;
  checked: boolean;
  onCheck: (on: boolean) => void;
}) {
  const suffix = STATUS_SUFFIXES[c.status];
  const rowClass = cn(
    "mx-3 flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm hover:bg-muted/60",
    c.status !== "active" && "text-muted-foreground",
  );
  const remaining = c.remaining_amount ?? 0;
  const content = (
    <>
      <span className="truncate">{displayName(c.first_name, c.last_name)}</span>
      {suffix && <span className="shrink-0 text-xs">({suffix})</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {overdue > 0 && (
          <AlarmClock
            className="size-3.5 text-destructive"
            role="img"
            aria-label={plural(overdue, "tâche en retard", "tâches en retard")}
          />
        )}
        {unread > 0 && <UnreadBadge count={unread} />}
        {show.payments && remaining > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums",
              PILL_TONE_CLASSES.warn,
            )}
          >
            <span className="sr-only">Reste à payer : </span>
            {formatDA(remaining)}
          </span>
        )}
        {show.stage && stageName && (
          <span className="max-w-28 truncate text-xs text-muted-foreground">
            <span className="sr-only">Étape : </span>
            {stageName}
          </span>
        )}
        {show.level && (
          <span className="text-xs text-muted-foreground">
            {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
          </span>
        )}
      </span>
    </>
  );

  if (selecting) {
    return (
      <label className={cn(rowClass, "cursor-pointer pl-5")}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="size-4 shrink-0 accent-primary"
        />
        {content}
      </label>
    );
  }
  return (
    <Link
      href={`/cases/${c.id}`}
      aria-current={isSelected ? "page" : undefined}
      className={cn(rowClass, isSelected && "bg-accent font-medium text-accent-foreground")}
    >
      {content}
    </Link>
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

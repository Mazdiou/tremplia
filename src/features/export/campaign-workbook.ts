import type { CaseFieldsRecord, DiplomaRecord, LanguageTestRecord } from "@/features/cases/case-record";
import {
  DIPLOMA_TYPE_LABELS,
  EDUCATION_LEVEL_LABELS,
  LANGUAGE_TEST_LABELS,
  STATUS_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { paymentMethodLabel } from "@/features/payments/schemas";
import {
  PROGRAM_RESULT_LABELS,
  programLevelLabel,
  programResult,
  programResultsSummary,
} from "@/features/programs/schemas";
import { formatShortDate, todayInAppTimezone } from "@/lib/dates";
import { displayName } from "@/lib/names";
import type { Sheet } from "@/lib/xlsx";

// Export Excel d'une campagne : une feuille Dossiers, une feuille Formations
// et une feuille Paiements. Jamais de compte externe (identifiant ou mot de
// passe), ni de note, de message ou de document.

export type ExportCase = CaseFieldsRecord & {
  id: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  agreed_amount: number | null;
  paid_amount: number;
  remaining_amount: number | null;
  stage_id: string | null;
};

export type ExportProgram = {
  case_id: string;
  position: number;
  title: string;
  level: string;
  city: string;
  institution: string | null;
  result: string | null;
};

export type ExportPayment = {
  case_id: string;
  amount: number;
  paid_on: string;
  method: string;
  note: string | null;
  created_by: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

type CampaignExportData = {
  cases: ExportCase[];
  groups: { id: string; name: string }[];
  // Étapes de la campagne, dans l'ordre
  stages: { id: string; name: string }[];
  caseGroups: { case_id: string; group_id: string }[];
  members: { id: string; first_name: string; last_name: string }[];
  programs: ExportProgram[];
  payments: ExportPayment[];
};

// « Licence – Informatique (2025) ; Baccalauréat (2022) »
export function diplomasSummary(diplomas: DiplomaRecord[]): string {
  return diplomas
    .map((d) => {
      const title = d.title ? ` – ${d.title}` : "";
      const year = d.year ? ` (${d.year})` : "";
      return `${labelOf(DIPLOMA_TYPE_LABELS, d.type)}${title}${year}`;
    })
    .join(" ; ");
}

// « TCF B2 (12/03/2026) ; IELTS 6.5 »
export function languageTestsSummary(tests: LanguageTestRecord[]): string {
  return tests
    .map((t) => {
      const name = t.test === "other" && t.other_name ? t.other_name : labelOf(LANGUAGE_TEST_LABELS, t.test);
      const result = t.result ? ` ${t.result}` : "";
      const date = t.date ? ` (${formatShortDate(t.date)})` : "";
      return `${name}${result}${date}`;
    })
    .join(" ; ");
}

const byName = (a: { last_name: string; first_name: string }, b: { last_name: string; first_name: string }) =>
  a.last_name.localeCompare(b.last_name, "fr", { sensitivity: "base" }) ||
  a.first_name.localeCompare(b.first_name, "fr", { sensitivity: "base" });

export function campaignWorkbook(data: CampaignExportData): Sheet[] {
  const cases = [...data.cases].sort(byName);
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const order = new Map(cases.map((c, i) => [c.id, i]));
  const memberName = new Map(data.members.map((m) => [m.id, displayName(m.first_name, m.last_name)]));
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));
  const groupOrder = new Map(data.groups.map((g, i) => [g.id, i]));
  // « 3. Entretien » : le numéro garde l'ordre quand on trie la colonne
  const stageLabel = new Map(data.stages.map((s, i) => [s.id, `${i + 1}. ${s.name}`]));

  const groupsOf = new Map<string, string[]>();
  for (const cg of [...data.caseGroups].sort(
    (a, b) => (groupOrder.get(a.group_id) ?? 0) - (groupOrder.get(b.group_id) ?? 0),
  )) {
    const name = groupName.get(cg.group_id);
    if (name) groupsOf.set(cg.case_id, [...(groupsOf.get(cg.case_id) ?? []), name]);
  }
  const resultsOf = new Map<string, string[]>();
  for (const p of data.programs) {
    resultsOf.set(p.case_id, [...(resultsOf.get(p.case_id) ?? []), programResult(p.result)]);
  }

  const dossiers: Sheet = {
    name: "Dossiers",
    columns: [
      { header: "Nom", width: 18 },
      { header: "Prénom", width: 16 },
      { header: "Date de naissance", width: 12, kind: "date" },
      { header: "Téléphone", width: 15 },
      { header: "E-mail", width: 26 },
      { header: "Ville", width: 14 },
      { header: "Nationalité", width: 13 },
      { header: "Contact secondaire", width: 18 },
      { header: "Tél. contact secondaire", width: 15 },
      { header: "Niveau", width: 12 },
      { header: "Filière actuelle", width: 22 },
      { header: "Établissement actuel", width: 24 },
      { header: "Diplômes", width: 32 },
      { header: "Tests de langue", width: 28 },
      { header: "Groupes", width: 18 },
      { header: "Responsable", width: 18 },
      { header: "Statut", width: 11 },
      { header: "Étape", width: 26 },
      { header: "Créé le", width: 12, kind: "date" },
      { header: "Formations", width: 9, kind: "number" },
      { header: "Réponses", width: 30 },
      { header: "Montant convenu", width: 15, kind: "amount" },
      { header: "Payé", width: 14, kind: "amount" },
      { header: "Reste à payer", width: 14, kind: "amount" },
    ],
    rows: cases.map((c) => {
      const results = resultsOf.get(c.id) ?? [];
      return [
        c.last_name.toLocaleUpperCase("fr"),
        c.first_name,
        c.birth_date,
        c.phone,
        c.email,
        c.city,
        c.nationality,
        c.secondary_contact_name,
        c.secondary_contact_phone,
        labelOf(EDUCATION_LEVEL_LABELS, c.education_level),
        c.current_field,
        c.current_institution,
        diplomasSummary(c.diplomas ?? []),
        languageTestsSummary(c.language_tests ?? []),
        (groupsOf.get(c.id) ?? []).join(", "),
        c.assigned_to ? memberName.get(c.assigned_to) : null,
        labelOf(STATUS_LABELS, c.status),
        c.stage_id ? (stageLabel.get(c.stage_id) ?? null) : null,
        todayInAppTimezone(new Date(c.created_at)),
        results.length,
        programResultsSummary(results),
        c.agreed_amount,
        c.agreed_amount === null ? null : c.paid_amount,
        c.remaining_amount,
      ];
    }),
  };

  const formations: Sheet = {
    name: "Formations",
    columns: [
      { header: "Nom", width: 18 },
      { header: "Prénom", width: 16 },
      { header: "N°", width: 5, kind: "number" },
      { header: "Intitulé", width: 40 },
      { header: "Niveau", width: 14 },
      { header: "Ville", width: 14 },
      { header: "Établissement", width: 28 },
      { header: "Réponse", width: 20 },
    ],
    rows: data.programs
      .filter((p) => caseById.has(p.case_id))
      .sort((a, b) => order.get(a.case_id)! - order.get(b.case_id)! || a.position - b.position)
      .map((p) => {
        const c = caseById.get(p.case_id)!;
        return [
          c.last_name.toLocaleUpperCase("fr"),
          c.first_name,
          p.position,
          p.title,
          programLevelLabel(p.level),
          p.city,
          p.institution,
          PROGRAM_RESULT_LABELS[programResult(p.result)],
        ];
      }),
  };

  const paiements: Sheet = {
    name: "Paiements",
    columns: [
      { header: "Nom", width: 18 },
      { header: "Prénom", width: 16 },
      { header: "Date", width: 12, kind: "date" },
      { header: "Montant", width: 14, kind: "amount" },
      { header: "Moyen", width: 20 },
      { header: "Note", width: 30 },
      { header: "Enregistré par", width: 18 },
      { header: "État", width: 10 },
      { header: "Motif de l'annulation", width: 30 },
    ],
    rows: data.payments
      .filter((p) => caseById.has(p.case_id))
      .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || order.get(a.case_id)! - order.get(b.case_id)!)
      .map((p) => {
        const c = caseById.get(p.case_id)!;
        return [
          c.last_name.toLocaleUpperCase("fr"),
          c.first_name,
          p.paid_on,
          p.amount,
          paymentMethodLabel(p.method),
          p.note,
          memberName.get(p.created_by),
          p.cancelled_at ? "Annulé" : "Valide",
          p.cancel_reason,
        ];
      }),
  };

  return [dossiers, formations, paiements];
}

// « Campagne 2026 - 15-10-2026.xlsx » : caractères interdits des noms de
// fichier retirés
export function exportFileName(campaignName: string, todayISO: string): string {
  const [y, m, d] = todayISO.split("-");
  const base = campaignName.replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
  return `${base || "Campagne"} - ${d}-${m}-${y}.xlsx`;
}

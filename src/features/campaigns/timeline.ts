import { daysUntil } from "@/lib/dates";

export const CAMPAIGN_DATES = [
  { key: "opens_on", label: "Ouverture des candidatures" },
  { key: "deadline_non_dap", label: "Date limite hors-DAP" },
  { key: "deadline_dap", label: "Date limite DAP" },
  {
    key: "deadline_pro",
    label: "Date limite licences professionnelles et BUT",
  },
  { key: "interviews_end_on", label: "Fin des entretiens" },
  { key: "institutions_answer_deadline", label: "Réponses des établissements" },
  { key: "final_choice_deadline", label: "Choix définitif" },
] as const;

type DateKey = (typeof CAMPAIGN_DATES)[number]["key"];

export type CampaignRow = { label: string } & Partial<
  Record<DateKey, string | null>
>;

export function campaignTimeline(campaign: CampaignRow, todayISO: string) {
  const items = CAMPAIGN_DATES.flatMap(({ key, label }) => {
    const date = campaign[key];
    return date ? [{ key, label, date, days: daysUntil(date, todayISO) }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));

  const nextKey = items.find((i) => i.days >= 0)?.key ?? null;
  return { items, nextKey };
}

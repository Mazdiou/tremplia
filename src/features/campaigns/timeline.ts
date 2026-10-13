import { daysUntil } from "@/lib/dates";

export type CampaignDate = {
  campaignId: string;
  campaignName: string;
  label: string;
  date: string; // AAAA-MM-JJ
};

export type TimelineItem = CampaignDate & { days: number };

// Dates triées (puis par libellé), avec le nombre de jours restants
// (négatif une fois la date passée).
export function timeline(dates: CampaignDate[], todayISO: string): TimelineItem[] {
  return dates
    .map((d) => ({ ...d, days: daysUntil(d.date, todayISO) }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.campaignName.localeCompare(b.campaignName, "fr") ||
        a.label.localeCompare(b.label, "fr"),
    );
}

// Prochaine échéance (aujourd'hui compris) parmi toutes les campagnes données
export function nextDeadline(
  dates: CampaignDate[],
  todayISO: string,
): TimelineItem | null {
  return timeline(dates, todayISO).find((d) => d.days >= 0) ?? null;
}

// « aujourd'hui », « demain », « J-12 », « passée »
export function countdownLabel(days: number) {
  if (days < 0) return "passée";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `J-${days}`;
}

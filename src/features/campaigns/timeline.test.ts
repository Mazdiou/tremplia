import { describe, expect, it } from "vitest";
import { countdownLabel, nextDeadline, timeline, type CampaignDate } from "./timeline";

const dates: CampaignDate[] = [
  { campaignId: "fr", campaignName: "Campus France", label: "Date limite DAP", date: "2026-12-15" },
  { campaignId: "it", campaignName: "Italie", label: "Pré-inscription", date: "2026-11-02" },
  { campaignId: "fr", campaignName: "Campus France", label: "Ouverture", date: "2026-10-01" },
];

describe("échéances de plusieurs campagnes", () => {
  it("trie toutes les dates, toutes campagnes confondues", () => {
    expect(timeline(dates, "2026-10-13").map((d) => d.label)).toEqual([
      "Ouverture",
      "Pré-inscription",
      "Date limite DAP",
    ]);
  });

  it("donne la prochaine échéance avec sa campagne, sans les dates passées", () => {
    const next = nextDeadline(dates, "2026-10-13");
    expect(next).toMatchObject({ campaignName: "Italie", label: "Pré-inscription", days: 20 });
  });

  it("compte une échéance du jour comme à venir", () => {
    expect(nextDeadline(dates, "2026-11-02")?.days).toBe(0);
  });

  it("ne renvoie rien quand tout est passé ou qu'il n'y a aucune date", () => {
    expect(nextDeadline(dates, "2027-01-01")).toBeNull();
    expect(nextDeadline([], "2026-10-13")).toBeNull();
  });

  it("affiche le décompte en français", () => {
    expect([-1, 0, 1, 12].map(countdownLabel)).toEqual([
      "passée",
      "aujourd'hui",
      "demain",
      "J-12",
    ]);
  });
});

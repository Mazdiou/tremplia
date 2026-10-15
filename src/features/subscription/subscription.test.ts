import { describe, expect, it } from "vitest";
import { daysLeft, formatEndDate, subscriptionNotice } from "./subscription";

const now = new Date("2026-10-15T10:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe("daysLeft", () => {
  it("arrondit au jour supérieur et ne descend pas sous zéro", () => {
    expect(daysLeft(inDays(7), now)).toBe(7);
    expect(daysLeft(inDays(0.1), now)).toBe(1);
    expect(daysLeft(inDays(-3), now)).toBe(0);
  });
});

describe("formatEndDate", () => {
  it("affiche la date dans le fuseau d'Alger", () => {
    // 23 h 30 UTC le 21 = 0 h 30 le 22 à Alger
    expect(formatEndDate("2026-10-21T23:30:00Z")).toBe("22/10/2026");
  });
});

describe("subscriptionNotice", () => {
  it("essai : jours restants et date", () => {
    expect(subscriptionNotice({ state: "trial", endsAt: inDays(3) }, now)).toEqual({
      tone: "info",
      text: "Essai gratuit : 3 jours restants (jusqu'au 18/10/2026). Pour continuer après",
    });
    expect(subscriptionNotice({ state: "trial", endsAt: inDays(0.5) }, now)?.text).toContain(
      "1 jour restant ",
    );
  });

  it("abonnement payé : rien, sauf dans les 7 derniers jours", () => {
    expect(subscriptionNotice({ state: "active", endsAt: inDays(30) }, now)).toBeNull();
    expect(subscriptionNotice({ state: "active", endsAt: inDays(5) }, now)).toEqual({
      tone: "warn",
      text: "Votre abonnement se termine le 20/10/2026 (dans 5 jours). Pensez à le renouveler",
    });
  });

  it("agence de l'administrateur : jamais de bandeau", () => {
    expect(subscriptionNotice({ state: "exempt", endsAt: inDays(-30) }, now)).toBeNull();
    expect(subscriptionNotice({ state: "exempt", endsAt: inDays(2) }, now)).toBeNull();
  });

  it("expiré : lecture seule expliquée", () => {
    const n = subscriptionNotice({ state: "expired", endsAt: inDays(-2) }, now);
    expect(n?.tone).toBe("bad");
    expect(n?.text).toContain("Abonnement expiré le 13/10/2026");
    expect(n?.text).toContain("plus rien ne peut être ajouté ni modifié");
  });
});

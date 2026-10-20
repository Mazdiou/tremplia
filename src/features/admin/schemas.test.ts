import { describe, expect, it } from "vitest";
import {
  cancelPlatformPaymentSchema,
  giftMonthsSchema,
  newEndDate,
  platformPaymentSchema,
} from "./schemas";

describe("platformPaymentSchema", () => {
  it("accepte 1, 3 ou 12 mois et un montant saisi avec espaces", () => {
    const r = platformPaymentSchema.parse({ months: 12, amount: "30 000", method: "baridimob", note: " " });
    expect(r).toEqual({ months: 12, amount: 30000, method: "baridimob" });
  });

  it("refuse une autre durée, un montant nul et un moyen inconnu", () => {
    const r = platformPaymentSchema.safeParse({ months: 2, amount: "0", method: "carte" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["months", "amount", "method"]);
  });
});

describe("giftMonthsSchema", () => {
  it("accepte une durée et un motif", () => {
    expect(giftMonthsSchema.parse({ months: 3, note: " Partenaire " })).toEqual({
      months: 3,
      note: "Partenaire",
    });
  });

  it("exige le motif et refuse un moyen « offert » côté paiement", () => {
    expect(giftMonthsSchema.safeParse({ months: 3, note: " " }).success).toBe(false);
    expect(platformPaymentSchema.safeParse({ months: 1, amount: "0", method: "gift" }).success).toBe(false);
  });
});

describe("cancelPlatformPaymentSchema", () => {
  it("exige un motif", () => {
    expect(cancelPlatformPaymentSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(cancelPlatformPaymentSchema.parse({ reason: " Erreur " })).toEqual({ reason: "Erreur" });
  });
});

describe("newEndDate", () => {
  const now = new Date("2026-10-15T10:00:00Z");

  it("ajoute la durée à la fin en cours", () => {
    expect(newEndDate("2026-12-01T10:00:00Z", 1, now).toISOString()).toBe("2027-01-01T10:00:00.000Z");
    expect(newEndDate("2026-12-01T10:00:00Z", 12, now).toISOString()).toBe("2027-12-01T10:00:00.000Z");
  });

  it("part de maintenant si l'abonnement est expiré", () => {
    expect(newEndDate("2026-09-01T00:00:00Z", 3, now).toISOString()).toBe("2027-01-15T10:00:00.000Z");
  });

  it("comme la base : fin de mois ramenée au dernier jour", () => {
    expect(newEndDate("2027-01-31T08:00:00Z", 1, now).toISOString()).toBe("2027-02-28T08:00:00.000Z");
    expect(newEndDate("2027-11-30T08:00:00Z", 3, now).toISOString()).toBe("2028-02-29T08:00:00.000Z");
  });
});

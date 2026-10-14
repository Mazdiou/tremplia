import { describe, expect, it } from "vitest";
import { todayInAppTimezone } from "@/lib/dates";
import {
  optionalAmountSchema,
  paymentSummary,
  recordPaymentSchema,
} from "./schemas";

const today = todayInAppTimezone();

describe("recordPaymentSchema", () => {
  it("accepte un montant saisi avec des espaces", () => {
    const r = recordPaymentSchema.parse({
      amount: "40 000",
      paidOn: today,
      method: "cash",
      note: "  ",
    });
    expect(r).toEqual({ amount: 40000, paidOn: today, method: "cash", note: undefined });
  });

  it("refuse un montant nul, vide ou invalide", () => {
    for (const amount of [0, "", "12,5", -5]) {
      expect(
        recordPaymentSchema.safeParse({ amount, paidOn: today, method: "cash" }).success,
      ).toBe(false);
    }
  });

  it("refuse une date future et un moyen inconnu", () => {
    expect(
      recordPaymentSchema.safeParse({ amount: 1, paidOn: "2999-01-01", method: "cash" }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({ amount: 1, paidOn: today, method: "bitcoin" }).success,
    ).toBe(false);
  });
});

describe("optionalAmountSchema", () => {
  it("vide = absent, zéro accepté", () => {
    expect(optionalAmountSchema.parse("")).toBeUndefined();
    expect(optionalAmountSchema.parse("0")).toBe(0);
    expect(optionalAmountSchema.parse("150 000")).toBe(150000);
  });
});

describe("paymentSummary", () => {
  it("calcule le reste et l'état", () => {
    expect(paymentSummary(null, 0)).toMatchObject({ state: "unset", remaining: null });
    expect(paymentSummary(150000, 0)).toMatchObject({ state: "unpaid", remaining: 150000, percent: 0 });
    expect(paymentSummary(150000, 60000)).toMatchObject({ state: "partial", remaining: 90000, percent: 40 });
    expect(paymentSummary(150000, 150000)).toMatchObject({ state: "paid", remaining: 0, percent: 100 });
  });

  it("un dossier gratuit est soldé", () => {
    expect(paymentSummary(0, 0)).toMatchObject({ state: "paid", percent: 100 });
  });

  it("n'affiche jamais 100 % avant le solde", () => {
    expect(paymentSummary(150000, 149999).percent).toBe(99);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_KEYS,
  notificationPreferencesSchema,
  preferenceInfo,
  pushEndpointSchema,
  pushSubscriptionSchema,
} from "./schemas";

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
  },
};

describe("pushSubscriptionSchema", () => {
  it("accepte l'abonnement donné par le navigateur", () => {
    expect(pushSubscriptionSchema.parse(subscription)).toEqual(subscription);
  });

  it("ignore les champs en plus (expirationTime)", () => {
    expect(pushSubscriptionSchema.parse({ ...subscription, expirationTime: null })).toEqual(
      subscription,
    );
  });

  it("refuse une adresse non chiffrée, trop longue ou sans clés valides", () => {
    for (const bad of [
      { ...subscription, endpoint: "http://fcm.googleapis.com/x" },
      { ...subscription, endpoint: `https://x.test/${"a".repeat(1000)}` },
      { ...subscription, keys: { ...subscription.keys, auth: "court" } },
      { ...subscription, keys: { ...subscription.keys, p256dh: "pas de base64 !" } },
      { endpoint: subscription.endpoint },
    ]) {
      expect(pushSubscriptionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("l'adresse seule suffit pour désactiver", () => {
    expect(pushEndpointSchema.safeParse({ endpoint: subscription.endpoint }).success).toBe(true);
    expect(pushEndpointSchema.safeParse({ endpoint: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("notificationPreferencesSchema", () => {
  it("exige les quatre choix, en booléens", () => {
    expect(notificationPreferencesSchema.parse(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
    expect(notificationPreferencesSchema.safeParse({ studentMessages: true }).success).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, dailyTasks: "oui" }).success,
    ).toBe(false);
  });

  it("par défaut : tout sauf le récapitulatif du matin", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      studentMessages: true,
      studentReviews: true,
      studentDocuments: true,
      assignedTasks: true,
      dailyTasks: false,
    });
  });

  it("chaque choix a son libellé ; le patron reçoit aussi les dossiers sans responsable", () => {
    for (const isOwner of [true, false]) {
      const info = preferenceInfo(isOwner);
      expect(Object.keys(info).sort()).toEqual([...PREFERENCE_KEYS].sort());
    }
    expect(preferenceInfo(true).studentMessages.description).toContain("sans responsable");
    expect(preferenceInfo(false).studentMessages.description).not.toContain("sans responsable");
  });
});

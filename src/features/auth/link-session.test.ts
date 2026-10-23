import { describe, expect, it } from "vitest";
import { openedByEmailLink } from "./link-session";

const NOW = 1_800_000_000;

describe("openedByEmailLink", () => {
  it("session ouverte par un lien depuis moins d'une heure", () => {
    expect(openedByEmailLink([{ method: "otp", timestamp: NOW - 60 }], NOW)).toBe(true);
  });

  it("lien ouvert il y a plus d'une heure", () => {
    expect(openedByEmailLink([{ method: "otp", timestamp: NOW - 3601 }], NOW)).toBe(false);
  });

  it("session ouverte avec le mot de passe", () => {
    expect(openedByEmailLink([{ method: "password", timestamp: NOW }], NOW)).toBe(false);
  });

  it("valeur absente ou mal formée", () => {
    expect(openedByEmailLink(undefined, NOW)).toBe(false);
    expect(openedByEmailLink("otp", NOW)).toBe(false);
    expect(openedByEmailLink([{ method: "otp", timestamp: "hier" }], NOW)).toBe(false);
    expect(openedByEmailLink([null], NOW)).toBe(false);
  });
});

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NO_ACCOUNT, createNonce, googleSignInError } from "./google";

describe("createNonce", () => {
  it("donne à Google l'empreinte SHA-256 de la valeur gardée pour Supabase", async () => {
    const { raw, hashed } = await createNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(createHash("sha256").update(raw).digest("hex"));
  });

  it("change à chaque essai", async () => {
    const [a, b] = await Promise.all([createNonce(), createNonce()]);
    expect(a.raw).not.toBe(b.raw);
  });
});

describe("googleSignInError", () => {
  it("adresse Google sans compte : inscriptions fermées", () => {
    expect(googleSignInError({ code: "signup_disabled", status: 422 })).toBe(NO_ACCOUNT);
  });

  it("employé désactivé", () => {
    expect(googleSignInError({ code: "user_banned", status: 403 })).toMatch(/désactivé/);
  });

  it("trop d'essais", () => {
    expect(googleSignInError({ code: "over_request_rate_limit", status: 429 })).toMatch(/Trop d'essais/);
  });

  it("Google pas activé dans Supabase", () => {
    expect(googleSignInError({ code: "provider_disabled", status: 400 })).toMatch(/pas disponible/);
  });

  it("autre refus : message général, sans détail technique", () => {
    expect(googleSignInError({ code: "bad_jwt", status: 400 })).toMatch(/^Connexion avec Google impossible/);
    expect(googleSignInError({})).toMatch(/^Connexion avec Google impossible/);
  });
});

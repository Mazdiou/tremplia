import { describe, expect, it } from "vitest";
import { PASSWORDS_DIFFER, PASSWORD_TOO_SHORT, newPasswordErrors, registerSchema } from "./schemas";

const valid = {
  agencyName: "Agence Horizon",
  city: "Tizi Ouzou",
  phone: "0550 12 34 56",
  firstName: "Amine",
  lastName: "Madiou",
  email: " Amine@Exemple.DZ ",
  password: "mot-de-passe-1",
  acceptTerms: true,
};

describe("registerSchema", () => {
  it("inscription valide, adresse normalisée", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("amine@exemple.dz");
  });

  it("conditions non acceptées : refusée", () => {
    for (const acceptTerms of [false, undefined, "true"]) {
      const result = registerSchema.safeParse({ ...valid, acceptTerms });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Acceptez les conditions pour créer le compte");
    }
  });
});

describe("newPasswordErrors", () => {
  it("accepte deux mots de passe identiques et assez longs", () => {
    expect(newPasswordErrors("mot-de-passe", "mot-de-passe")).toEqual({});
  });

  it("signale un mot de passe trop court sous son champ", () => {
    expect(newPasswordErrors("court", "court")).toEqual({ password: PASSWORD_TOO_SHORT });
  });

  it("signale une confirmation différente sous son champ", () => {
    expect(newPasswordErrors("mot-de-passe", "mot-de-passe-2")).toEqual({ confirm: PASSWORDS_DIFFER });
  });
});

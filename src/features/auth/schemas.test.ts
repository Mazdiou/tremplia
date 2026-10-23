import { describe, expect, it } from "vitest";
import { registerSchema } from "./schemas";

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

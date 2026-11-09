import { describe, expect, it } from "vitest";
import {
  isSignupSlug,
  signupSettingsSchema,
  signupSubmitSchema,
  slugFromName,
} from "./schemas";

const CAMPAIGN = "c1111111-1111-4111-8111-111111111111";

const valid = {
  firstName: "Amine",
  lastName: "Kaci",
  birthDate: "2005-03-10",
  phone: "0555 12 34 56",
  email: "",
  city: "Tizi Ouzou",
  nationality: "",
  secondaryContactName: "",
  secondaryContactPhone: "",
  educationLevel: "terminale",
  currentField: "",
  currentInstitution: "",
  diplomas: [],
  languageTests: [],
  campaignId: CAMPAIGN,
  message: "",
  consent: true,
  website: "",
};

const paths = (input: unknown) => {
  const r = signupSubmitSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("slugFromName", () => {
  it("adresse proposée à partir du nom de l'agence", () => {
    expect(slugFromName("Atlas Études")).toBe("atlas-etudes");
    expect(slugFromName("  Younes Démarches & Visa  ")).toBe("younes-demarches-visa");
    expect(slugFromName("Fennec360")).toBe("fennec360");
  });

  it("toujours une adresse valide, même pour un nom court ou sans lettre latine", () => {
    for (const name of ["AB", "É", "وكالة", "x".repeat(80), "a - - b"]) {
      expect(isSignupSlug(slugFromName(name))).toBe(true);
    }
    expect(slugFromName("AB")).toBe("ab-agence");
    expect(slugFromName("وكالة")).toBe("agence");
  });
});

describe("isSignupSlug", () => {
  it("minuscules, chiffres et tirets entre deux mots", () => {
    expect(isSignupSlug("atlas-etudes")).toBe(true);
    expect(isSignupSlug("Atlas")).toBe(false);
    expect(isSignupSlug("-atlas")).toBe(false);
    expect(isSignupSlug("atlas--etudes")).toBe(false);
    expect(isSignupSlug("ab")).toBe(false);
    expect(isSignupSlug("a".repeat(51))).toBe(false);
  });
});

describe("signupSettingsSchema", () => {
  it("une page ouverte a une adresse", () => {
    expect(signupSettingsSchema.safeParse({ enabled: true, slug: "", campaignIds: [] }).success).toBe(
      false,
    );
    expect(signupSettingsSchema.safeParse({ enabled: false, slug: "", campaignIds: [] }).success).toBe(
      true,
    );
  });

  it("l'adresse est mise en minuscules ; les accents sont refusés", () => {
    const r = signupSettingsSchema.parse({ enabled: true, slug: " Atlas-Etudes ", campaignIds: [] });
    expect(r.slug).toBe("atlas-etudes");
    expect(
      signupSettingsSchema.safeParse({ enabled: true, slug: "atlas-études", campaignIds: [] }).success,
    ).toBe(false);
  });
});

describe("signupSubmitSchema", () => {
  it("accepte une demande complète", () => {
    expect(paths(valid)).toEqual([]);
  });

  it("exige l'accord du candidat et une campagne", () => {
    expect(paths({ ...valid, consent: false })).toEqual(["consent"]);
    expect(paths({ ...valid, campaignId: "" })).toEqual(["campaignId"]);
    expect(paths({ ...valid, campaignId: "pas-un-identifiant" })).toEqual(["campaignId"]);
  });

  it("mêmes règles que le dossier pour l'identité", () => {
    expect(paths({ ...valid, phone: "12" })).toEqual(["phone"]);
    expect(paths({ ...valid, secondaryContactName: "Maman" })).toEqual(["secondaryContactPhone"]);
  });

  it("message facultatif, 1000 caractères au plus", () => {
    expect(signupSubmitSchema.parse({ ...valid, message: "   " }).message).toBeUndefined();
    expect(paths({ ...valid, message: "x".repeat(1001) })).toEqual(["message"]);
  });

  it("le champ piège n'empêche pas la validation (le serveur l'ignore en silence)", () => {
    expect(paths({ ...valid, website: "https://spam.example" })).toEqual([]);
  });
});

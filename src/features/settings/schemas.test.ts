import { describe, expect, it } from "vitest";
import { campaignDefaultsSchema, ownNameSchema, passwordChangeSchema } from "./schemas";

describe("passwordChangeSchema", () => {
  it("accepte un nouveau mot de passe différent de l'actuel", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "ancien-mdp", password: "nouveau-mdp" })
        .success,
    ).toBe(true);
  });

  it("refuse le même mot de passe, sur le champ du nouveau", () => {
    const r = passwordChangeSchema.safeParse({ currentPassword: "meme-mdp-1", password: "meme-mdp-1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["password"]);
  });

  it("refuse un nouveau mot de passe trop court ou un actuel vide", () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "x", password: "court" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "", password: "assez-long" }).success).toBe(false);
  });
});

describe("campaignDefaultsSchema", () => {
  it("accepte un tarif saisi avec espaces, ou vide", () => {
    expect(
      campaignDefaultsSchema.parse({ defaultFee: "", platforms: [], stages: [] }).defaultFee,
    ).toBeUndefined();
    expect(
      campaignDefaultsSchema.parse({ defaultFee: "150 000", platforms: [], stages: [] }).defaultFee,
    ).toBe(150000);
  });

  it("refuse des doublons (majuscules ignorées)", () => {
    expect(
      campaignDefaultsSchema.safeParse({ platforms: ["Pastel", "PASTEL"], stages: [] }).success,
    ).toBe(false);
    expect(
      campaignDefaultsSchema.safeParse({ platforms: [], stages: ["Visa", "visa"] }).success,
    ).toBe(false);
  });

  it("enlève les espaces autour des noms", () => {
    expect(
      campaignDefaultsSchema.parse({ platforms: [" Pastel "], stages: [" Visa "] }),
    ).toMatchObject({ platforms: ["Pastel"], stages: ["Visa"] });
  });
});

describe("ownNameSchema", () => {
  it("exige un prénom et un nom", () => {
    expect(ownNameSchema.safeParse({ firstName: "  ", lastName: "Benali" }).success).toBe(false);
    expect(ownNameSchema.parse({ firstName: " Amina ", lastName: "Benali" })).toEqual({
      firstName: "Amina",
      lastName: "Benali",
    });
  });
});

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

const AAD = "agence-1:compte-1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test";
  process.env.SUPABASE_SECRET_KEY = "test";
  process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  delete process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY;
});

describe("chiffrement des mots de passe des comptes externes", () => {
  it("déchiffre ce qu'il a chiffré", () => {
    const { value } = encryptSecret("Mot2Passe!é", AAD);
    expect(decryptSecret(value, AAD)).toBe("Mot2Passe!é");
  });

  it("ne laisse pas le texte clair dans la valeur stockée", () => {
    const { value } = encryptSecret("secret-visible", AAD);
    expect(value).not.toContain("secret-visible");
    expect(Buffer.from(value, "base64").toString("utf8")).not.toContain(
      "secret-visible",
    );
  });

  it("produit une valeur différente à chaque chiffrement", () => {
    expect(encryptSecret("x", AAD).value).not.toBe(encryptSecret("x", AAD).value);
  });

  it("refuse de déchiffrer pour un autre compte", () => {
    const { value } = encryptSecret("x", AAD);
    expect(() => decryptSecret(value, "agence-1:compte-2")).toThrow();
  });

  it("refuse une valeur modifiée", () => {
    const buf = Buffer.from(encryptSecret("x", AAD).value, "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decryptSecret(buf.toString("base64"), AAD)).toThrow();
  });

  it("refuse de déchiffrer avec une autre clé", () => {
    const { value } = encryptSecret("x", AAD);
    process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptSecret(value, AAD)).toThrow();
  });

  it("donne une erreur claire si la clé manque ou est mal formée", () => {
    delete process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x", AAD)).toThrow(/EXTERNAL_ACCOUNTS_ENCRYPTION_KEY/);
    process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY = Buffer.from("trop court").toString("base64");
    expect(() => encryptSecret("x", AAD)).toThrow(/EXTERNAL_ACCOUNTS_ENCRYPTION_KEY/);
  });

  it("ne met jamais la valeur de la clé dans le message d'erreur", () => {
    const bad = Buffer.from("trop court").toString("base64");
    process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY = bad;
    try {
      encryptSecret("x", AAD);
    } catch (e) {
      expect((e as Error).message).not.toContain(bad);
    }
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-errors";
import { weakPasswordError } from "./accounts";

describe("weakPasswordError", () => {
  it("mot de passe refusé par Supabase Auth : message sur le champ", () => {
    const error = weakPasswordError({ code: "weak_password" });
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.status).toBe(400);
    expect(error?.message).toMatch(/trop faible/);
    expect(error?.extra?.fields).toEqual([{ path: "password", message: "Mot de passe trop faible" }]);
  });

  it("toute autre erreur (ou aucune) : rien", () => {
    expect(weakPasswordError({ code: "email_exists" })).toBeNull();
    expect(weakPasswordError({})).toBeNull();
    expect(weakPasswordError(null)).toBeNull();
  });
});

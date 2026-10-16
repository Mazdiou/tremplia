import { describe, expect, it } from "vitest";
import { dbError, rateLimited } from "./api-errors";

describe("erreurs de la base", () => {
  it("une limite d'essais répond 429, avec le message du contexte", () => {
    const e = rateLimited({ code: "54000" }, "Trop de tentatives.");
    expect(e?.status).toBe(429);
    expect(e?.message).toBe("Trop de tentatives.");
    expect(rateLimited({ code: "42501" }, "x")).toBeNull();
  });

  it("un plafond de quantité garde le 409", () => {
    expect(dbError("test", { code: "54000" }, { "54000": "Limite de 30 groupes" }).status).toBe(409);
  });

  it("une erreur inconnue devient une erreur serveur, sans détail", () => {
    const e = dbError("test", { code: "XX000" });
    expect(e.status).toBe(500);
    expect(e.message).toBe("Erreur serveur");
  });
});

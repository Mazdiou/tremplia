import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });

describe("clientIp", () => {
  it("prend la dernière adresse de x-forwarded-for (celle du dernier relais)", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // Une adresse inventée par le visiteur, puis la vraie ajoutée par le relais
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("lit l'en-tête choisi pour l'hébergeur", () => {
    const r = req({ "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "198.51.100.9" });
    expect(clientIp(r, "cf-connecting-ip")).toBe("198.51.100.9");
  });

  it("se rabat sur x-real-ip sans x-forwarded-for", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    // Mais pas quand un autre en-tête est choisi
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }), "cf-connecting-ip")).toBe("inconnue");
  });

  it("sans en-tête, renvoie une valeur commune", () => {
    expect(clientIp(req({}))).toBe("inconnue");
    expect(clientIp(req({ "x-forwarded-for": " " }))).toBe("inconnue");
  });
});

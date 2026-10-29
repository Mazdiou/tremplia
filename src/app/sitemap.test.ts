import { describe, expect, it } from "vitest";
import { LEGAL } from "@/config/legal";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("liste les pages publiques sur l'adresse du site, sans page utilitaire", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://www.tremplia.com/");
    expect(urls.every((u) => u.startsWith("https://www.tremplia.com/"))).toBe(true);
    expect(urls.some((u) => /password|auth|dashboard|cases/.test(u))).toBe(false);
  });

  it("date les pages légales avec leur vraie date de mise à jour, et elles seules", () => {
    const dated = sitemap().filter((e) => e.lastModified);
    expect(dated.map((e) => e.url.replace("https://www.tremplia.com", ""))).toEqual([
      "/mentions-legales",
      "/conditions",
      "/confidentialite",
    ]);
    for (const e of dated) {
      expect((e.lastModified as Date).toISOString().slice(0, 10)).toBe(LEGAL.updatedAt);
    }
  });
});

import { describe, expect, it } from "vitest";
import { BRAND } from "@/config/brand";
import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("adresse de la marque par défaut", () => {
    expect(siteUrl({})).toBe(BRAND.url);
    expect(siteUrl({ SITE_URL: "  " })).toBe(BRAND.url);
  });

  it("réglage SITE_URL, ramené à l'origine", () => {
    expect(siteUrl({ SITE_URL: "http://127.0.0.1:3000/" })).toBe("http://127.0.0.1:3000");
    expect(siteUrl({ SITE_URL: "https://exemple.dz/chemin?x=1" })).toBe("https://exemple.dz");
  });

  it("valeur invalide : adresse de la marque", () => {
    expect(siteUrl({ SITE_URL: "pas une adresse" })).toBe(BRAND.url);
    expect(siteUrl({ SITE_URL: "javascript:alert(1)" })).toBe(BRAND.url);
  });
});

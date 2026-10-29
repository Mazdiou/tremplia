import { describe, expect, it } from "vitest";
import { jsonLd, landingStructuredData } from "./structured-data";

const site = "https://www.tremplia.com";

describe("landingStructuredData", () => {
  it("décrit l'organisation, le site et le logiciel, reliés entre eux", () => {
    const data = landingStructuredData({ site, description: "Suivi des dossiers.", phone: "213552753559" });
    const types = data["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    const [org, website, app] = data["@graph"] as Record<string, unknown>[];
    expect(org).toMatchObject({
      "@id": `${site}/#organization`,
      url: site,
      logo: `${site}/icons/icon-512.png`,
      contactPoint: { telephone: "+213552753559" },
    });
    expect(website.publisher).toEqual({ "@id": `${site}/#organization` });
    expect(app).toMatchObject({ applicationCategory: "BusinessApplication", description: "Suivi des dossiers." });
    // Ni prix ni avis : rien qui ne soit sur la page
    expect(JSON.stringify(data)).not.toMatch(/offers|aggregateRating|review/);
  });

  it("sans téléphone configuré, pas de numéro", () => {
    const data = landingStructuredData({ site, description: "x", phone: null });
    expect(JSON.stringify(data)).not.toContain("telephone");
  });
});

describe("jsonLd", () => {
  it("ne laisse jamais fermer la balise script", () => {
    const text = jsonLd({ a: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toEqual({ a: "</script><script>alert(1)</script>" });
  });
});

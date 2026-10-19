import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { redact, scrubEvent } from "./sentry";

describe("suivi des erreurs : aucune donnée personnelle", () => {
  it("masque e-mails et numéros de téléphone", () => {
    expect(redact("doublon pour amine.madiou@gmail.com")).toBe("doublon pour [e-mail]");
    expect(redact("tel 0555 12 34 56 et +213 555 123 456")).toBe("tel [numéro] et [numéro]");
    expect(redact("[tasks count] 42P01")).toBe("[tasks count] 42P01");
    // Identifiants et petits nombres gardés : utiles pour comprendre l'erreur
    expect(redact("dossier ad699dc5-72c8-4340-999e-a1c65187c286 ligne 42")).toBe(
      "dossier ad699dc5-72c8-4340-999e-a1c65187c286 ligne 42",
    );
  });

  it("retire utilisateur, cookies, en-têtes, corps et paramètres de la requête", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "a@b.dz", ip_address: "1.2.3.4" },
      request: {
        url: "https://app/cases/1",
        cookies: { sb: "jeton" },
        headers: { cookie: "sb=jeton" },
        data: { phone: "0555123456" },
        query_string: "q=Madiou",
      },
      message: "écrire à x@y.fr",
      exception: { values: [{ type: "Error", value: "échec pour 0555123456" }] },
      breadcrumbs: [
        { message: "appel 0661 22 33 44" },
        { category: "fetch", data: { url: "/api/cases/search?q=Kaci" } },
        { category: "console", message: "Error: a@b.dz", data: { arguments: ["a@b.dz"] } },
      ],
    } as ErrorEvent);

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://app/cases/1" });
    expect(event.message).toBe("écrire à [e-mail]");
    expect(event.exception?.values?.[0].value).toBe("échec pour [numéro]");
    expect(event.breadcrumbs?.[0].message).toBe("appel [numéro]");
    expect(event.breadcrumbs?.[1].data?.url).toBe("/api/cases/search");
    expect(event.breadcrumbs?.[2]).toEqual({ category: "console", message: "Error: [e-mail]" });
  });
});

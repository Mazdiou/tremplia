import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUPABASE_TEMPLATES,
  authLink,
  confirmEmailEmail,
  formatReminderDate,
  passwordResetEmail,
  renderEmail,
  subscriptionReminderEmail,
} from "./templates";

describe("renderEmail", () => {
  it("échappe le contenu, dans le HTML seulement", () => {
    const email = renderEmail("Sujet", {
      title: "<b>Titre</b>",
      paragraphs: ['Agence « A & B" »'],
      action: { label: "Ouvrir", url: "https://x.dz/?a=1&b=2" },
    });
    expect(email.html).toContain("&lt;b&gt;Titre&lt;/b&gt;");
    expect(email.html).toContain("Agence « A &amp; B&quot; »");
    expect(email.html).toContain('href="https://x.dz/?a=1&amp;b=2"');
    expect(email.html).not.toContain("<b>Titre</b>");
    expect(email.text).toContain("<b>Titre</b>");
    expect(email.text).toContain("Ouvrir : https://x.dz/?a=1&b=2");
  });
});

describe("liens et e-mails de connexion", () => {
  it("lien vers /auth/confirm", () => {
    expect(authLink("https://www.tremplia.com", "abc123", "recovery")).toBe(
      "https://www.tremplia.com/auth/confirm?token_hash=abc123&type=recovery",
    );
  });

  it("mot de passe oublié : lien dans le HTML et le texte", () => {
    const link = authLink("https://www.tremplia.com", "f00d", "recovery");
    const email = passwordResetEmail(link);
    expect(email.subject).toContain("mot de passe");
    expect(email.text).toContain(link);
    expect(email.html).toContain(link.replace("&", "&amp;"));
  });

  it("confirmation : prénom facultatif", () => {
    expect(confirmEmailEmail("https://x.dz", "Amine").text).toContain("Bonjour Amine,");
    expect(confirmEmailEmail("https://x.dz").text).toContain("Bonjour,");
  });
});

describe("rappels d'abonnement", () => {
  const base = {
    agencyName: "Agence Horizon",
    firstName: "Amine",
    endsAt: "2026-10-29T23:30:00Z",
    supportPhone: "0550 12 34 56",
    appUrl: "https://www.tremplia.com/dashboard",
  };

  it("date vue en Algérie (le 29 à 23 h 30 UTC est déjà le 30 à Alger)", () => {
    expect(formatReminderDate(base.endsAt)).toBe("vendredi 30 octobre 2026");
  });

  it("essai, 7 jours avant", () => {
    const email = subscriptionReminderEmail({ ...base, kind: "j7", trial: true });
    expect(email.subject).toBe("Votre essai Tremplia se termine dans 7 jours");
    expect(email.text).toContain("L'essai gratuit de l'agence « Agence Horizon » se termine le vendredi 30 octobre 2026.");
    expect(email.text).toContain("0550 12 34 56");
  });

  it("abonnement, la veille, sans numéro", () => {
    const email = subscriptionReminderEmail({ ...base, kind: "j1", trial: false, supportPhone: null });
    expect(email.subject).toBe("Votre abonnement Tremplia se termine demain");
    expect(email.text).toContain("Pour renouveler, répondez simplement à cet e-mail.");
  });
});

// WRITE_SUPABASE_TEMPLATES=1 npx vitest run templates : réécrit les fichiers
describe("modèles Supabase (supabase/templates)", () => {
  for (const [name, email] of Object.entries(SUPABASE_TEMPLATES)) {
    it(`${name}.html à jour`, () => {
      const file = path.resolve(__dirname, `../../../supabase/templates/${name}.html`);
      if (process.env.WRITE_SUPABASE_TEMPLATES) writeFileSync(file, email.html + "\n");
      expect(readFileSync(file, "utf8")).toBe(email.html + "\n");
      expect(email.html).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=");
    });
  }
});

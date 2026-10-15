import { describe, expect, it } from "vitest";
import {
  availableTemplates,
  toWhatsAppNumber,
  whatsAppMessage,
  whatsAppUrl,
  type WhatsAppContext,
} from "./whatsapp";

describe("toWhatsAppNumber", () => {
  it("ajoute l'indicatif algérien aux numéros locaux", () => {
    expect(toWhatsAppNumber("0555 12 34 56")).toBe("213555123456");
    expect(toWhatsAppNumber("0555.12.34.56")).toBe("213555123456");
    expect(toWhatsAppNumber("0661-98-76-54")).toBe("213661987654");
    expect(toWhatsAppNumber("555123456")).toBe("213555123456");
    // Fixe à 9 chiffres
    expect(toWhatsAppNumber("021 23 45 67")).toBe("21321234567");
  });

  it("garde l'indicatif d'un numéro international", () => {
    expect(toWhatsAppNumber("+33 6 12 34 56 78")).toBe("33612345678");
    expect(toWhatsAppNumber("0033 6 12 34 56 78")).toBe("33612345678");
    expect(toWhatsAppNumber("+213 (0)555 12 34 56")).toBe("213555123456");
    expect(toWhatsAppNumber("+213 555 12 34 56")).toBe("213555123456");
    expect(toWhatsAppNumber("213555123456")).toBe("213555123456");
  });

  it("refuse ce qui n'est pas un numéro", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("12 34")).toBeNull();
    expect(toWhatsAppNumber("à rappeler")).toBeNull();
    expect(toWhatsAppNumber("+0555123456")).toBeNull();
  });
});

describe("whatsAppUrl", () => {
  it("encode le message", () => {
    expect(whatsAppUrl("213555123456")).toBe("https://wa.me/213555123456");
    expect(whatsAppUrl("213555123456", "Bonjour à vous\nCode : A&B")).toBe(
      "https://wa.me/213555123456?text=Bonjour%20%C3%A0%20vous%0ACode%20%3A%20A%26B",
    );
  });
});

const ctx: WhatsAppContext = {
  candidate: "Yacine",
  agencyName: "Mazdiou Agency",
  agencyPhone: "0550 00 00 00",
  studentLink: "https://exemple.dz/student/login",
  accessCode: "K7P4M2QX",
  remaining: 25000,
};
const spaces = (s: string) => s.replace(/[  ]/g, " ");

describe("whatsAppMessage", () => {
  it("écrit au candidat", () => {
    expect(whatsAppMessage("access", ctx)).toBe(
      "Bonjour Yacine, voici votre espace candidat Mazdiou Agency :\nhttps://exemple.dz/student/login\nVotre code d'accès : K7P4M2QX\nVous pourrez y relire votre lettre de motivation et vos formations.",
    );
    expect(spaces(whatsAppMessage("payment", ctx))).toBe(
      "Bonjour Yacine, il reste 25 000 DA à régler pour votre dossier. Vous pouvez passer à l'agence quand vous le souhaitez.\nMazdiou Agency",
    );
    expect(whatsAppMessage("visit", ctx)).toBe(
      "Bonjour Yacine, merci de passer à l'agence dès que possible. Pour toute question : 0550 00 00 00.\nMazdiou Agency",
    );
    expect(whatsAppMessage("newMessage", ctx)).toBe(
      "Bonjour Yacine, vous avez reçu un nouveau message dans votre espace candidat : https://exemple.dz/student/login\nMazdiou Agency",
    );
    expect(whatsAppMessage("empty", ctx)).toBe("");
  });

  it("parle du dossier de l'étudiant au parent", () => {
    const parent = { ...ctx, parent: "Karim Benali" };
    expect(spaces(whatsAppMessage("payment", parent))).toContain(
      "Bonjour Karim Benali, il reste 25 000 DA à régler pour le dossier de Yacine.",
    );
    expect(whatsAppMessage("visit", parent)).toBe(
      "Bonjour Karim Benali, merci de passer à l'agence dès que possible pour le dossier de Yacine. Pour toute question : 0550 00 00 00.\nMazdiou Agency",
    );
  });
});

describe("availableTemplates", () => {
  it("propose l'accès seulement au candidat, avec un code", () => {
    expect(availableTemplates(ctx)).toEqual(["empty", "access", "newMessage", "payment", "visit"]);
    expect(availableTemplates({ ...ctx, parent: "Karim" })).toEqual(["empty", "payment", "visit"]);
    expect(availableTemplates({ ...ctx, accessCode: null })).toEqual(["empty", "payment", "visit"]);
  });

  it("propose le rappel seulement s'il reste à payer", () => {
    expect(availableTemplates({ ...ctx, remaining: 0 })).not.toContain("payment");
    expect(availableTemplates({ ...ctx, remaining: null })).not.toContain("payment");
  });
});

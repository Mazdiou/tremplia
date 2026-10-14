import { describe, expect, it } from "vitest";
import { amountInputValue, formatDA, parseAmount } from "./money";

describe("formatDA", () => {
  it("groupe les milliers et ajoute la devise", () => {
    expect(formatDA(150000).replace(/[  ]/g, " ")).toBe("150 000 DA");
    expect(formatDA(0).replace(/[  ]/g, " ")).toBe("0 DA");
  });

  it("ne coupe jamais le montant", () => {
    expect(formatDA(150000)).not.toMatch(/ /);
  });
});

describe("parseAmount", () => {
  it("accepte espaces et points de milliers", () => {
    expect(parseAmount("150000")).toBe(150000);
    expect(parseAmount(" 150 000 ")).toBe(150000);
    expect(parseAmount("150.000")).toBe(150000);
    expect(parseAmount("150 000")).toBe(150000);
  });

  it("vide : aucun montant", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("refuse le reste", () => {
    expect(parseAmount("12,5")).toBeNaN();
    expect(parseAmount("-100")).toBeNaN();
    expect(parseAmount("1e5")).toBeNaN();
    expect(parseAmount("1234567890")).toBeNaN();
  });
});

describe("amountInputValue", () => {
  it("affiche le montant groupé, vide sinon", () => {
    expect(amountInputValue(150000)).toBe("150 000");
    expect(amountInputValue(null)).toBe("");
  });
});

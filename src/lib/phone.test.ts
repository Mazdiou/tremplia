import { describe, expect, it } from "vitest";
import { formatPhone, telHref } from "./phone";

describe("formatPhone", () => {
  it("groupe un mobile par deux chiffres", () => {
    expect(formatPhone("0552753559")).toBe("05 52 75 35 59");
    expect(formatPhone("0552 75 35 59")).toBe("05 52 75 35 59");
  });

  it("groupe un fixe à neuf chiffres", () => {
    expect(formatPhone("026123456")).toBe("026 12 34 56");
  });

  it("laisse les autres formats tels quels", () => {
    expect(formatPhone("+213 552 75 35 59")).toBe("+213 552 75 35 59");
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("  0552  ")).toBe("0552");
  });
});

describe("telHref", () => {
  it("garde seulement les chiffres et le +", () => {
    expect(telHref("05 52 75 35 59")).toBe("tel:0552753559");
  });
});

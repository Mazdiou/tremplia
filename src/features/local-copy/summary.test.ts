import { describe, expect, it } from "vitest";
import { copySummary } from "./summary";

const r = (copied: number, removed: number, failed = 0) => ({ copied, removed, unchanged: 5, failed });

describe("copySummary", () => {
  it("rien à faire", () => {
    expect(copySummary(r(0, 0))).toEqual({ text: "La copie est déjà à jour.", error: false });
  });

  it("copiés et retirés", () => {
    expect(copySummary(r(1, 0)).text).toBe("Copie à jour : 1 document copié.");
    expect(copySummary(r(3, 2)).text).toBe("Copie à jour : 3 documents copiés, 2 fichiers retirés.");
  });

  it("échecs : signalés comme une erreur, avec ce qui a réussi", () => {
    const s = copySummary(r(2, 0, 1));
    expect(s.error).toBe(true);
    expect(s.text).toBe(
      "1 document n'a pas pu être copié (2 documents copiés). Un fichier est peut-être ouvert dans un autre programme : fermez-le et réessayez.",
    );
    expect(copySummary(r(0, 0, 2)).text).toMatch(/^2 documents n'ont pas pu être copiés\. /);
  });
});

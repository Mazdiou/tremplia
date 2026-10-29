import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES } from "./schemas";
import { documentNameOf, pdfProblem, uploadSummary } from "./upload";

describe("envoi des documents", () => {
  it("n'accepte que des PDF non vides de 10 Mo au plus", () => {
    expect(pdfProblem({ name: "Relevé.PDF", size: 1 })).toBeNull();
    expect(pdfProblem({ name: "Relevé.pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
    expect(pdfProblem({ name: "photo.jpg", size: 10 })).toMatch(/PDF/);
    expect(pdfProblem({ name: "vide.pdf", size: 0 })).toMatch(/10 Mo/);
    expect(pdfProblem({ name: "gros.pdf", size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/10 Mo/);
  });

  it("nomme le document d'après le fichier, sans l'extension", () => {
    expect(documentNameOf("  Passeport.pdf")).toBe("Passeport");
    expect(documentNameOf("Bac.2024.PDF")).toBe("Bac.2024");
    expect(documentNameOf(".pdf")).toBe("Document");
    expect(documentNameOf(`${"a".repeat(200)}.pdf`)).toHaveLength(120);
  });

  it("résume un envoi réussi en tout ou partie", () => {
    expect(uploadSummary(1, null)).toEqual({ text: "Document ajouté", error: false });
    expect(uploadSummary(3, null)).toEqual({ text: "3 documents ajoutés", error: false });
    expect(uploadSummary(2, "c.pdf : refusé")).toEqual({
      text: "2 documents ajoutés. c.pdf : refusé",
      error: true,
    });
    expect(uploadSummary(0, "c.pdf : refusé")).toEqual({ text: "c.pdf : refusé", error: true });
  });
});

import { describe, expect, it } from "vitest";
import { archiveEntries, archiveFileName, safeFileName } from "./archive";

describe("archive ZIP des documents", () => {
  it("retire les caractères interdits dans un nom de fichier", () => {
    expect(safeFileName('Relevé 1/2 : "S1"', "Document")).toBe("Relevé 1-2 - -S1-");
    expect(safeFileName("  Passeport.  ", "Document")).toBe("Passeport");
    expect(safeFileName("///", "Document")).toBe("---");
    expect(safeFileName("  ", "Document")).toBe("Document");
  });

  it("évite les noms réservés par Windows et coupe sans laisser de point final", () => {
    expect(safeFileName("CON", "Document")).toBe("CON_");
    expect(safeFileName("nul.pdf", "Document")).toBe("nul.pdf_");
    expect(safeFileName("Console", "Document")).toBe("Console");
    expect(safeFileName("Bac S. Maths", "Document", 6)).toBe("Bac S");
  });

  it("range les documents par dossier et numérote les noms en double", () => {
    expect(
      archiveEntries(
        [
          { id: "d1", name: "Passeport", folder_id: null },
          { id: "d2", name: "Relevé", folder_id: "f1" },
          { id: "d3", name: "relevé", folder_id: "f1" },
          { id: "d4", name: "Relevé", folder_id: null },
          { id: "d5", name: "Photo", folder_id: "inconnu" },
        ],
        [{ id: "f1", name: "Notes / relevés" }],
      ),
    ).toEqual([
      { id: "d1", path: "Passeport.pdf" },
      { id: "d2", path: "Notes - relevés/Relevé.pdf" },
      { id: "d3", path: "Notes - relevés/relevé (2).pdf" },
      { id: "d4", path: "Relevé.pdf" },
      { id: "d5", path: "Photo.pdf" },
    ]);
  });

  it("nomme l'archive d'après le candidat", () => {
    expect(archiveFileName("Karim", "Benali")).toBe("Documents - BENALI Karim.zip");
  });
});

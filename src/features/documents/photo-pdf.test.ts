import { describe, expect, it } from "vitest";
import { buildPdf, isImageFile, photoNameOf, placeOnA4 } from "./photo-pdf";

const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("isImageFile", () => {
  it("reconnaît les photos par leur type ou leur extension", () => {
    expect(isImageFile({ name: "IMG_1.jpg", type: "image/jpeg" })).toBe(true);
    expect(isImageFile({ name: "scan.HEIC", type: "" })).toBe(true);
    expect(isImageFile({ name: "photo", type: "image/png" })).toBe(true);
    expect(isImageFile({ name: "relevé.pdf", type: "application/pdf" })).toBe(false);
    expect(isImageFile({ name: "notes.docx", type: "" })).toBe(false);
  });
});

describe("photoNameOf", () => {
  it("retire l'extension, avec un nom par défaut", () => {
    expect(photoNameOf(" Passeport.jpeg")).toBe("Passeport");
    expect(photoNameOf(".png")).toBe("Document scanné");
    expect(photoNameOf(`${"a".repeat(200)}.jpg`)).toHaveLength(120);
  });
});

describe("placeOnA4", () => {
  it("garde le sens et les proportions de l'image, centrée", () => {
    const portrait = placeOnA4(1000, 2000);
    expect(portrait.pageWidth).toBeLessThan(portrait.pageHeight);
    expect(portrait.h).toBeCloseTo(portrait.pageHeight);
    expect(portrait.w / portrait.h).toBeCloseTo(0.5);
    expect(portrait.x).toBeCloseTo((portrait.pageWidth - portrait.w) / 2);

    const landscape = placeOnA4(3000, 2000);
    expect(landscape.pageWidth).toBeGreaterThan(landscape.pageHeight);
    expect(landscape.w / landscape.h).toBeCloseTo(1.5);
  });
});

describe("buildPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = buildPdf([
    { jpeg, width: 40, height: 80 },
    { jpeg, width: 80, height: 40 },
  ]);
  const text = latin1(pdf);

  it("commence par la signature contrôlée par le serveur", () => {
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("une page par image, l'image recopiée telle quelle", () => {
    expect(text).toContain("/Count 2");
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(text.split(latin1(jpeg))).toHaveLength(3);
  });

  it("table des positions exacte", () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const [, first, count] = /xref\n(\d+) (\d+)\n/.exec(text)!;
    expect(first).toBe("0");
    expect(Number(count)).toBe(9); // objet 0, catalogue, pages, 3 objets par page
    const entries = text.slice(startxref).split("\n").slice(3, 3 + 8);
    entries.forEach((line, i) => {
      expect(line).toHaveLength(19); // 20 octets avec le saut de ligne
      const at = Number(line.slice(0, 10));
      expect(text.slice(at).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
  });

  it("longueur du contenu de page exacte", () => {
    const m = /<< \/Length (\d+) >>\nstream\n([^\n]*)\nendstream/.exec(text)!;
    expect(m[2]).toHaveLength(Number(m[1]));
  });
});

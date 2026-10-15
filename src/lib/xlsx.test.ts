import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildXlsx, columnLetter, escapeXml, excelDate, sheetName } from "./xlsx";

describe("columnLetter", () => {
  it("numérote comme Excel", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(701)).toBe("ZZ");
    expect(columnLetter(702)).toBe("AAA");
  });
});

describe("excelDate", () => {
  it("compte les jours depuis le 30/12/1899", () => {
    expect(excelDate("1900-03-01")).toBe(61);
    expect(excelDate("2026-10-15")).toBe(46310);
  });
  it("refuse une date invalide", () => {
    expect(excelDate("15/10/2026")).toBeNull();
    expect(excelDate("2026-13-01")).toBeNull();
  });
});

describe("escapeXml", () => {
  it("échappe et retire les caractères de contrôle", () => {
    expect(escapeXml(`<a & "b">\u0001`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
  });
});

describe("sheetName", () => {
  it("respecte les règles d'Excel", () => {
    expect(sheetName("A/B:C")).toBe("A B C");
    expect(sheetName("x".repeat(40))).toHaveLength(31);
    expect(sheetName("  ")).toBe("Feuille");
  });
});

describe("buildXlsx", () => {
  const files = unzipSync(
    buildXlsx([
      {
        name: "Dossiers",
        columns: [
          { header: "Nom", width: 10 },
          { header: "Né le", width: 10, kind: "date" },
          { header: "Montant", width: 10, kind: "amount" },
        ],
        rows: [
          ["=SOMME(A1)", "2026-10-15", 150000],
          ["Éloïse", null, undefined],
        ],
      },
    ]),
  );
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);

  it("contient les parties d'un classeur", () => {
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(files[part]).toBeDefined();
    }
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Dossiers"');
  });

  it("écrit un texte en chaîne, jamais en formule", () => {
    expect(sheet).toContain("<t xml:space=\"preserve\">=SOMME(A1)</t>");
    expect(sheet).not.toContain("<f>");
  });

  it("écrit dates et montants en valeurs", () => {
    expect(sheet).toContain('<c r="B2" s="2"><v>46310</v></c>');
    expect(sheet).toContain('<c r="C2" s="3"><v>150000</v></c>');
  });

  it("laisse vides les cases sans valeur et fige l'en-tête", () => {
    expect(sheet).toContain('<row r="3"><c r="A3" t="inlineStr" s="0"><is><t xml:space="preserve">Éloïse</t></is></c></row>');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<autoFilter ref="A1:C3"/>');
  });
});

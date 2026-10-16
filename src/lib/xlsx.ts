import { strToU8, zipSync } from "fflate";

// Classeur Excel (.xlsx) minimal : des feuilles de tableaux, une ligne
// d'en-tête figée avec filtres, des dates et des montants en vraies valeurs
// (triables, additionnables). Les textes sont écrits en chaînes : un texte
// qui commence par « = » reste un texte, jamais une formule.

type ColumnKind = "text" | "date" | "amount" | "number";

export type Column = { header: string; width: number; kind?: ColumnKind };

// Texte, nombre, date AAAA-MM-JJ (colonne « date ») ou case vide
export type CellValue = string | number | null | undefined;

export type Sheet = { name: string; columns: Column[]; rows: CellValue[][] };

// Styles (ordre de cellXfs dans styles.xml)
const STYLE = { text: 0, header: 1, date: 2, amount: 3, number: 0 } as const;

// Lettre de colonne Excel : 0 → A, 25 → Z, 26 → AA
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Numéro de série Excel d'une date AAAA-MM-JJ (jours depuis le 30/12/1899)
export function excelDate(iso: string): number | null {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(t)) return null;
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// Échappement XML ; les caractères de contrôle, interdits en XML, sont retirés
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Nom de feuille accepté par Excel : 31 caractères, sans []:*?/\
export function sheetName(name: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return clean || "Feuille";
}

function textCell(ref: string, value: string, style: number) {
  // Excel limite une cellule à 32 767 caractères
  const v = escapeXml(value.slice(0, 32_767));
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${v}</t></is></c>`;
}

function cell(ref: string, value: CellValue, kind: ColumnKind): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "date" && typeof value === "string") {
    const serial = excelDate(value);
    return serial === null
      ? textCell(ref, value, STYLE.text)
      : `<c r="${ref}" s="${STYLE.date}"><v>${serial}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${STYLE[kind]}"><v>${value}</v></c>`;
  }
  return textCell(ref, String(value), STYLE.text);
}

function sheetXml(sheet: Sheet): string {
  const { columns, rows } = sheet;
  const last = columnLetter(Math.max(columns.length - 1, 0));
  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("");
  const header = `<row r="1">${columns
    .map((c, i) => textCell(`${columnLetter(i)}1`, c.header, STYLE.header))
    .join("")}</row>`;
  const body = rows
    .map((row, r) => {
      const n = r + 2;
      const cells = columns
        .map((c, i) => cell(`${columnLetter(i)}${n}`, row[i], c.kind ?? "text"))
        .join("");
      return `<row r="${n}">${cells}</row>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    "</sheetView></sheetViews>" +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    `<autoFilter ref="A1:${last}${rows.length + 1}"/>` +
    "</worksheet>"
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  // Montant : « 150 000 DA »
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;DA&quot;"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  // 14 : date courte selon la langue d'Excel (15/12/2026 en français)
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

// Classeur complet, prêt à être envoyé (application/vnd.openxmlformats-…)
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const names = sheets.map((s) => sheetName(s.name));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${names
          .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("")}</sheets>` +
        // Zone des filtres de chaque feuille, comme Excel l'enregistre
        `<definedNames>${sheets
          .map((s, i) => {
            const last = columnLetter(Math.max(s.columns.length - 1, 0));
            const quoted = escapeXml(names[i].replace(/'/g, "''"));
            return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${quoted}'!$A$1:$${last}$${s.rows.length + 1}</definedName>`;
          })
          .join("")}</definedNames>` +
        "</workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
  });
  return zipSync(files, { level: 6 });
}

import { MAX_DOCUMENT_BYTES } from "./schemas";

// Photos de documents (téléphone, scanner) transformées en PDF dans le
// navigateur : chaque photo est réduite, recompressée en JPEG puis posée sur
// une page A4. Aucun envoi avant la fin : le serveur ne reçoit que le PDF.

export const MAX_PHOTOS_PER_PDF = 30;

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i;

// Photo à assembler en PDF (le type est parfois vide sur certains téléphones)
export function isImageFile(file: Pick<File, "name" | "type">) {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name);
}

// Nom d'un document créé à partir d'une seule photo : celui du fichier, sans
// l'extension
export function photoNameOf(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim().slice(0, 120) || "Document scanné";
}

// Une page : une image JPEG et ses dimensions en pixels
export type JpegPage = { jpeg: Uint8Array; width: number; height: number };

const A4 = { width: 595.28, height: 841.89 }; // en points PDF

// Page A4 dans le sens de l'image, image agrandie ou réduite pour la remplir
// sans la déformer, puis centrée
export function placeOnA4(width: number, height: number) {
  const landscape = width > height;
  const pageWidth = landscape ? A4.height : A4.width;
  const pageHeight = landscape ? A4.width : A4.height;
  const scale = Math.min(pageWidth / width, pageHeight / height);
  const w = width * scale;
  const h = height * scale;
  return { pageWidth, pageHeight, x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, w, h };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

// PDF minimal : catalogue, liste des pages, puis pour chaque page son objet,
// son contenu (dessin de l'image) et l'image JPEG telle quelle (DCTDecode).
export function buildPdf(pages: JpegPage[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  // En-tête, suivi d'une ligne d'octets non ASCII qui signale un fichier binaire
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageId = (i: number) => 3 + i * 3;
  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  const kids = pages.map((_, i) => `${pageId(i)} 0 R`).join(" ");
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const id = pageId(i);
    const box = placeOnA4(page.width, page.height);
    startObject(id);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(box.pageWidth)} ${num(box.pageHeight)}]` +
        ` /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>\nendobj\n`,
    );
    const content = `q ${num(box.w)} 0 0 ${num(box.h)} ${num(box.x)} ${num(box.y)} cm /Im0 Do Q`;
    startObject(id + 1);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObject(id + 2);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    push("\nendstream\nendobj\n");
  });

  // Table des positions de chaque objet, chaque ligne faisant 20 octets
  const xrefAt = length;
  const size = offsets.length;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// Navigateur

// Réglages essayés dans l'ordre : on ne réduit davantage que si le PDF
// dépasse la limite. 2000 px sur le grand côté restent bien lisibles.
const QUALITY_STEPS = [
  { maxSide: 2000, quality: 0.82 },
  { maxSide: 1600, quality: 0.72 },
  { maxSide: 1200, quality: 0.6 },
];

export class PhotoError extends Error {}

async function photoToJpeg(file: File, maxSide: number, quality: number): Promise<JpegPage> {
  let bitmap: ImageBitmap;
  try {
    // Tient compte de l'orientation enregistrée par le téléphone
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(
      `${file.name} : photo illisible par ce navigateur (utilisez JPG ou PNG)`,
    );
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoError("La préparation du PDF a échoué, réessayez");
    // Fond blanc : les zones transparentes d'un PNG deviendraient noires
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    canvas.width = canvas.height = 0; // libère la mémoire tout de suite (Safari)
    if (!blob) throw new PhotoError("La préparation du PDF a échoué, réessayez");
    return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    bitmap.close();
  }
}

// Assemble les photos, dans l'ordre, en un PDF de 10 Mo au plus.
// onPage(n) est appelé avant de préparer la page n (à partir de 1).
// Lève une PhotoError dont le message peut être montré tel quel.
export async function photosToPdf(
  files: File[],
  onPage?: (n: number) => void,
): Promise<Uint8Array> {
  for (const step of QUALITY_STEPS) {
    const pages: JpegPage[] = [];
    for (const [i, file] of files.entries()) {
      onPage?.(i + 1);
      pages.push(await photoToJpeg(file, step.maxSide, step.quality));
    }
    const pdf = buildPdf(pages);
    if (pdf.length <= MAX_DOCUMENT_BYTES) return pdf;
  }
  throw new PhotoError(
    "Le PDF dépasserait 10 Mo : retirez des pages ou faites plusieurs documents",
  );
}

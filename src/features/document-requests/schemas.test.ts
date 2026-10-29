import { describe, expect, it } from "vitest";
import {
  acceptRequestSchema,
  documentRequestSchema,
  studentAddDocumentSchema,
  studentUploadSchema,
} from "./schemas";

const ID = "3f2b8c1e-7a4d-4e2b-9c6f-1a2b3c4d5e6f";

describe("documentRequestSchema", () => {
  it("garde le nom sans espaces autour, avec ou sans dossier de rangement", () => {
    expect(documentRequestSchema.parse({ label: "  Passeport ", folderId: null })).toEqual({
      label: "Passeport",
      folderId: null,
    });
    expect(documentRequestSchema.parse({ label: "Visa", folderId: ID }).folderId).toBe(ID);
  });

  it("refuse un nom vide ou trop long", () => {
    expect(documentRequestSchema.safeParse({ label: "  ", folderId: null }).success).toBe(false);
    expect(documentRequestSchema.safeParse({ label: "x".repeat(81), folderId: null }).success).toBe(
      false,
    );
    expect(documentRequestSchema.safeParse({ label: "x".repeat(80), folderId: null }).success).toBe(
      true,
    );
  });

  it("exige un dossier de rangement valide ou null", () => {
    expect(documentRequestSchema.safeParse({ label: "Visa" }).success).toBe(false);
    expect(documentRequestSchema.safeParse({ label: "Visa", folderId: "x" }).success).toBe(false);
  });
});

describe("acceptRequestSchema", () => {
  it("exige l'état voulu et le document vu par le membre", () => {
    expect(acceptRequestSchema.safeParse({ accepted: true, documentId: ID }).success).toBe(true);
    expect(acceptRequestSchema.safeParse({ accepted: true }).success).toBe(false);
    expect(acceptRequestSchema.safeParse({ accepted: "oui", documentId: ID }).success).toBe(false);
  });
});

describe("envoi du candidat", () => {
  it("n'accepte qu'un PDF de 10 Mo au plus, pour une pièce", () => {
    const ok = { requestId: ID, originalFileName: "passeport.PDF", sizeBytes: 1000 };
    expect(studentUploadSchema.safeParse(ok).success).toBe(true);
    expect(studentUploadSchema.safeParse({ ...ok, originalFileName: "photo.jpg" }).success).toBe(false);
    expect(studentUploadSchema.safeParse({ ...ok, sizeBytes: 0 }).success).toBe(false);
    expect(studentUploadSchema.safeParse({ ...ok, sizeBytes: 10 * 1024 * 1024 + 1 }).success).toBe(
      false,
    );
    expect(studentUploadSchema.safeParse({ ...ok, requestId: "x" }).success).toBe(false);
  });

  it("confirme un envoi par son identifiant", () => {
    expect(
      studentAddDocumentSchema.safeParse({ documentId: ID, originalFileName: "p.pdf" }).success,
    ).toBe(true);
    expect(studentAddDocumentSchema.safeParse({ documentId: ID, originalFileName: " " }).success).toBe(
      false,
    );
  });
});

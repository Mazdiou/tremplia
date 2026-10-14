import { describe, expect, it } from "vitest";
import { studentReviewSchema } from "./schemas";

describe("studentReviewSchema", () => {
  it("accepte une validation sans message", () => {
    expect(studentReviewSchema.parse({ decision: "approved", fingerprint: "f" })).toEqual({
      decision: "approved",
      fingerprint: "f",
    });
  });

  it("exige un message pour une demande de modification", () => {
    expect(
      studentReviewSchema.safeParse({ decision: "changes_requested", fingerprint: "f", message: "  " }).success,
    ).toBe(false);
    expect(
      studentReviewSchema.parse({
        decision: "changes_requested",
        fingerprint: "f",
        message: " Ajouter Lille ",
      }),
    ).toEqual({ decision: "changes_requested", fingerprint: "f", message: "Ajouter Lille" });
  });

  it("refuse une réponse inconnue", () => {
    expect(studentReviewSchema.safeParse({ decision: "maybe", fingerprint: "f" }).success).toBe(false);
  });
});

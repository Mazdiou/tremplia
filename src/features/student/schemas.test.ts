import { describe, expect, it } from "vitest";
import { studentReviewSchema } from "./schemas";

describe("studentReviewSchema", () => {
  it("accepte une validation sans message", () => {
    expect(studentReviewSchema.parse({ decision: "approved" })).toEqual({ decision: "approved" });
  });

  it("exige un message pour une demande de modification", () => {
    expect(
      studentReviewSchema.safeParse({ decision: "changes_requested", message: "  " }).success,
    ).toBe(false);
    expect(
      studentReviewSchema.parse({ decision: "changes_requested", message: " Ajouter Lille " }),
    ).toEqual({ decision: "changes_requested", message: "Ajouter Lille" });
  });

  it("refuse une réponse inconnue", () => {
    expect(studentReviewSchema.safeParse({ decision: "maybe" }).success).toBe(false);
  });
});

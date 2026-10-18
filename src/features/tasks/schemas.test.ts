import { describe, expect, it } from "vitest";
import { taskSchema } from "./schemas";

const ASSIGNEE = "22222222-2222-4222-8222-222222222222";

describe("taskSchema", () => {
  it("accepte une tâche sans échéance ni précision", () => {
    const r = taskSchema.parse({ title: "  Appeler  ", details: " ", dueDate: "", assignedTo: ASSIGNEE });
    expect(r).toEqual({ title: "Appeler", details: undefined, dueDate: undefined, assignedTo: ASSIGNEE });
  });

  it("refuse un intitulé vide ou trop long", () => {
    expect(taskSchema.safeParse({ title: " ", assignedTo: ASSIGNEE }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "x".repeat(201), assignedTo: ASSIGNEE }).success).toBe(false);
  });

  it("refuse une date impossible ou hors bornes", () => {
    for (const dueDate of ["2026-02-30", "1999-12-31", "2101-01-01"]) {
      expect(taskSchema.safeParse({ title: "x", dueDate, assignedTo: ASSIGNEE }).success).toBe(false);
    }
  });

  it("exige un responsable", () => {
    expect(taskSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { can, effectivePermissions, parsePermissions } from "./permissions";

describe("parsePermissions", () => {
  it("garde les permissions connues, dans l'ordre de la liste", () => {
    expect(parsePermissions(["campaigns_manage", "payments_view"])).toEqual([
      "payments_view",
      "campaigns_manage",
    ]);
    expect(parsePermissions(["team_manage", "payments_manage"])).toEqual(["payments_manage"]);
    expect(parsePermissions(null)).toEqual([]);
    expect(parsePermissions("payments_view")).toEqual([]);
  });
});

describe("can", () => {
  it("le patron a tout ; l'employé seulement ce qui lui est accordé", () => {
    expect(can({ isOwner: true, permissions: [] }, "payments_manage")).toBe(true);
    expect(can({ isOwner: false, permissions: ["payments_view"] }, "payments_view")).toBe(true);
    expect(can({ isOwner: false, permissions: ["payments_view"] }, "payments_manage")).toBe(false);
    expect(effectivePermissions({ isOwner: true, permissions: [] })).toHaveLength(3);
    expect(effectivePermissions({ isOwner: false, permissions: ["campaigns_manage"] })).toEqual([
      "campaigns_manage",
    ]);
  });
});

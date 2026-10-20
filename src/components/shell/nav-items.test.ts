import { describe, expect, it } from "vitest";
import { navItems } from "./nav-items";

const hrefs = (...args: Parameters<typeof navItems>) => navItems(...args).map((i) => i.href);

describe("navItems", () => {
  it("le patron voit tout, un employé ce que ses permissions ouvrent", () => {
    expect(hrefs(true, false, [])).toEqual(
      expect.arrayContaining(["/payments", "/team"]),
    );
    expect(hrefs(false, false, [])).not.toContain("/payments");
    expect(hrefs(false, false, ["payments_view"])).toContain("/payments");
    // L'équipe reste au patron, quelles que soient les permissions
    expect(hrefs(false, false, ["payments_view", "payments_manage", "campaigns_manage"])).not.toContain(
      "/team",
    );
    expect(hrefs(false, true, [])).toContain("/admin");
  });
});

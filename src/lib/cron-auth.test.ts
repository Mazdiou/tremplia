import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

describe("isCronAuthorized", () => {
  it("bon secret", () => {
    expect(isCronAuthorized("Bearer s3cret-assez-long", "s3cret-assez-long")).toBe(true);
  });

  it("mauvais secret, autre schéma ou rien", () => {
    expect(isCronAuthorized("Bearer autre", "s3cret-assez-long")).toBe(false);
    expect(isCronAuthorized("Basic s3cret-assez-long", "s3cret-assez-long")).toBe(false);
    expect(isCronAuthorized(null, "s3cret-assez-long")).toBe(false);
  });

  it("sans CRON_SECRET, tout est refusé", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});

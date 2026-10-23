import { describe, expect, it } from "vitest";
import { hasStudentSessionHint } from "./session-hint";

const cookie = (payload: unknown) =>
  `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

describe("hasStudentSessionHint", () => {
  const now = Date.UTC(2026, 9, 23);

  it("reconnaît une session candidat non expirée", () => {
    expect(hasStudentSessionHint(cookie({ c: "x", a: "y", g: 1, e: now / 1000 + 60 }), now)).toBe(true);
  });

  it("ignore une session expirée, absente ou illisible", () => {
    expect(hasStudentSessionHint(cookie({ e: now / 1000 - 1 }), now)).toBe(false);
    expect(hasStudentSessionHint(undefined, now)).toBe(false);
    expect(hasStudentSessionHint("", now)).toBe(false);
    expect(hasStudentSessionHint("pas-du-json.sig", now)).toBe(false);
    expect(hasStudentSessionHint(cookie({ e: "demain" }), now)).toBe(false);
  });
});

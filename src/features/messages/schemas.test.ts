import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, messageSchema } from "./schemas";

describe("messageSchema", () => {
  it("garde le message sans les espaces autour, retours à la ligne compris", () => {
    expect(messageSchema.parse({ body: "  Bonjour,\nune question.  " })).toEqual({
      body: "Bonjour,\nune question.",
    });
  });

  it("refuse un message vide ou trop long", () => {
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "x".repeat(MAX_MESSAGE_LENGTH + 1) }).success).toBe(false);
  });
});

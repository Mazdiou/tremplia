import { describe, expect, it } from "vitest";
import { mergePlatforms } from "./platforms";

describe("plateformes suggérées", () => {
  it("fusionne dans l'ordre, sans doublon, majuscules ignorées", () => {
    expect(mergePlatforms(["Pastel", "Etudes en France"], ["PASTEL", "Parcoursup"])).toEqual([
      "Pastel",
      "Etudes en France",
      "Parcoursup",
    ]);
  });
});

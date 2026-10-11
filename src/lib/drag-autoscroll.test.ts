import { describe, expect, it } from "vitest";
import { autoScrollDelta } from "./drag-autoscroll";

// Conteneur de 0 à 600 pixels ; zones sensibles : 0–80 et 520–600
describe("autoScrollDelta", () => {
  it("ne bouge pas au milieu", () => {
    expect(autoScrollDelta(300, 0, 600)).toBe(0);
    expect(autoScrollDelta(80, 0, 600)).toBe(0);
    expect(autoScrollDelta(520, 0, 600)).toBe(0);
  });

  it("monte près du bord haut, de plus en plus vite", () => {
    const slow = autoScrollDelta(70, 0, 600);
    const fast = autoScrollDelta(5, 0, 600);
    expect(slow).toBeLessThan(0);
    expect(fast).toBeLessThan(slow);
  });

  it("descend près du bord bas", () => {
    expect(autoScrollDelta(590, 0, 600)).toBeGreaterThan(0);
  });

  it("plafonne la vitesse, même hors du conteneur", () => {
    expect(autoScrollDelta(-500, 0, 600)).toBe(-20);
    expect(autoScrollDelta(5000, 0, 600)).toBe(20);
  });

  it("tient compte de la position du conteneur à l'écran", () => {
    expect(autoScrollDelta(110, 100, 700)).toBeLessThan(0);
    expect(autoScrollDelta(300, 100, 700)).toBe(0);
  });

  it("ne défile pas si le conteneur est trop petit", () => {
    expect(autoScrollDelta(10, 0, 100)).toBe(0);
  });
});

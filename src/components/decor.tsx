import { cn } from "@/lib/utils";

// Décor des pages publiques : halo flou et quadrillage estompé vers les
// bords, aux couleurs du thème (variables --decor-* de globals.css). À
// placer dans un conteneur `relative overflow-hidden` de fond `bg-decor`.
// `glowClassName` : position, taille et flou du halo.
export function DecorLayers({
  glowClassName,
  grid = true,
}: {
  glowClassName: string;
  grid?: boolean;
}) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-decor-glow opacity-(--decor-glow-opacity)",
          glowClassName,
        )}
      />
      {grid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--decor-grid) 1px, transparent 1px), linear-gradient(90deg, var(--decor-grid) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      )}
    </>
  );
}

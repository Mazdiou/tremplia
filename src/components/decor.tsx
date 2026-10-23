import { cn } from "@/lib/utils";

// Décor des pages publiques : halo et quadrillage estompés vers les bords,
// aux couleurs du thème (variables --decor-* de globals.css). À placer dans
// un conteneur `relative overflow-hidden` de fond `bg-decor`.
// `glowClassName` : position et taille du halo.
// Le halo est un dégradé radial, pas un flou (filter: blur) : sur iPhone, un
// grand flou retardait l'affichage de la page, dont les boutons ne
// répondaient qu'après un premier défilement.
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
          "pointer-events-none absolute left-1/2 -translate-x-1/2 opacity-(--decor-glow-opacity)",
          glowClassName,
        )}
        style={{
          backgroundImage:
            // Paliers proches de l'ancien flou : fort au centre, bord invisible
            "radial-gradient(closest-side, var(--decor-glow) 0%, color-mix(in oklab, var(--decor-glow) 75%, transparent) 25%, color-mix(in oklab, var(--decor-glow) 40%, transparent) 50%, color-mix(in oklab, var(--decor-glow) 12%, transparent) 75%, transparent 100%)",
        }}
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

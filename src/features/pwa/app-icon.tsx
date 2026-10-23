import { ImageResponse } from "next/og";
import { BRAND } from "@/config/brand";
import { cairnSvg } from "@/components/logo-mark";

// Icône de l'application (le cairn, comme le logo des écrans), en PNG :
// onglet du navigateur, écran d'accueil du téléphone, manifeste.

const MARK_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(cairnSvg());

// - « rounded » : carré aux coins arrondis sur fond transparent (onglet)
// - « full » : fond plein jusqu'aux bords ; le système découpe lui-même la
//   forme (iPhone, icône « maskable » d'Android). Le dessin reste dans la
//   zone centrale sûre (80 %).
// - « badge » : le cairn seul, blanc sur fond transparent : petite icône
//   des notifications dans la barre d'état d'Android, qui n'en garde que la
//   silhouette.
export function appIcon(size: number, shape: "rounded" | "full" | "badge") {
  const full = shape === "full";
  const badge = shape === "badge";
  const mark = Math.round(size * (badge ? 0.84 : full ? 0.52 : 0.64));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: badge ? "transparent" : BRAND.colors.primary,
          borderRadius: full ? 0 : Math.round(size * 0.22),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK_SVG} width={mark} height={mark} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}

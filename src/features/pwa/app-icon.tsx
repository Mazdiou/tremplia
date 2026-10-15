import { ImageResponse } from "next/og";
import { BRAND } from "@/config/brand";

// Icône de l'application (toque de diplômé, comme le logo des écrans), en
// PNG : onglet du navigateur, écran d'accueil du téléphone, manifeste.

// Tracé de l'icône GraduationCap de lucide (24 × 24)
const CAP_PATHS = [
  "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
  "M22 10v6",
  "M6 12.5V16a6 3 0 0 0 12 0v-3.5",
];

const CAP_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${CAP_PATHS.map((d) => `<path d="${d}"/>`).join("")}</svg>`,
  );

// - « rounded » : carré aux coins arrondis sur fond transparent (onglet)
// - « full » : fond plein jusqu'aux bords ; le système découpe lui-même la
//   forme (iPhone, icône « maskable » d'Android). Le dessin reste dans la
//   zone centrale sûre (80 %).
export function appIcon(size: number, shape: "rounded" | "full") {
  const full = shape === "full";
  const cap = Math.round(size * (full ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.colors.primary,
          borderRadius: full ? 0 : Math.round(size * 0.22),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CAP_SVG} width={cap} height={cap} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}

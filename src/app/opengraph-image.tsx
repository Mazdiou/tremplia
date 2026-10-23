import { ImageResponse } from "next/og";
import { BRAND } from "@/config/brand";
import { cairnSvg } from "@/components/logo-mark";

// Image d'aperçu d'un lien partagé (WhatsApp, Facebook, LinkedIn…), créée
// au build. Pas de police externe : celle de next/og suffit.
export const alt = `${BRAND.name} · ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(cairnSvg());
const DOMAIN = new URL(BRAND.url).hostname.replace(/^www\./, "");
const FEATURES = ["Dossiers", "Documents", "Paiements", "Échéances", "Espace candidat"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: `linear-gradient(135deg, ${BRAND.colors.background} 0%, #e3ecff 100%)`,
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 28,
              background: BRAND.colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK_SVG} width={72} height={72} alt="" />
          </div>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>{BRAND.name}</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 940 }}>
          {BRAND.tagline}
        </div>
        <div style={{ marginTop: 40, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {FEATURES.map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                background: "#ffffff",
                border: "2px solid #d5e1fb",
                fontSize: 28,
                color: "#334155",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, display: "flex", gap: 18, fontSize: 30, fontWeight: 700 }}>
          <div style={{ color: BRAND.colors.primary }}>{DOMAIN}</div>
          <div style={{ color: "#64748b" }}>{"7 jours d'essai gratuit"}</div>
        </div>
      </div>
    ),
    size,
  );
}

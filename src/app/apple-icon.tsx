import { appIcon } from "@/features/pwa/app-icon";

// Icône de l'écran d'accueil sur iPhone et iPad (iOS arrondit lui-même)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180, "full");
}

"use client";

import { useEffect } from "react";
import { BRAND } from "@/config/brand";

// Posé une fois dans le layout racine :
// - enregistre le service worker (page « Pas de connexion »), en production ;
// - accorde la couleur de la barre d'état du téléphone au thème choisi dans
//   l'appli (clair / sombre), qui peut différer de celui du système.
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sans service worker, l'appli marche comme avant
      });
    }

    const root = document.documentElement;
    function syncThemeColor() {
      const color = root.classList.contains("dark") ? BRAND.colors.backgroundDark : BRAND.colors.background;
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      metas.forEach((m) => {
        m.removeAttribute("media");
        m.content = color;
      });
    }
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return null;
}

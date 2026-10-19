"use client";

import { useState } from "react";
import { TREE_WIDTH, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

// Largeur du panneau des dossiers : glisser la séparation à la souris, ou
// flèches gauche / droite au clavier. Mémorisée au relâchement.
export function useTreeWidth() {
  const [prefs, setPrefs] = useUiPrefs();
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? prefs.width;

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = prefs.width;
    let last = startWidth;
    function onMove(ev: PointerEvent) {
      last = Math.min(TREE_WIDTH.max, Math.max(TREE_WIDTH.min, startWidth + ev.clientX - startX));
      setDragWidth(last);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      setPrefs({ width: last });
      setDragWidth(null);
    }
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const separator = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionner le panneau"
      aria-valuenow={width}
      aria-valuemin={TREE_WIDTH.min}
      aria-valuemax={TREE_WIDTH.max}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPrefs({ width: width - 16 });
        if (e.key === "ArrowRight") setPrefs({ width: width + 16 });
      }}
      className={cn(
        "hidden w-px shrink-0 cursor-col-resize bg-border outline-none transition-colors hover:w-0.5 hover:bg-primary/40 focus-visible:w-0.5 focus-visible:bg-ring",
        !prefs.collapsed && "md:block",
      )}
    />
  );

  return { width, separator };
}

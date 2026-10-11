import { useEffect, type RefObject } from "react";

// Défilement automatique pendant un glisser-déposer.
// Les navigateurs ne font pas défiler un conteneur interne (overflow-y-auto)
// quand on glisse près de son bord : sans ce code, impossible d'atteindre un
// dossier hors de l'écran.

const EDGE_PX = 80; // zone sensible, en haut et en bas du conteneur
const MAX_SPEED = 20; // pixels par image, au plus près du bord
const IDLE_MS = 600; // sans événement de glisser, on arrête (Firefox : ~350 ms entre deux)

// Vitesse de défilement : négative vers le haut, positive vers le bas, 0 au milieu.
// Plus le pointeur est près du bord (ou au-delà), plus ça va vite.
export function autoScrollDelta(y: number, top: number, bottom: number) {
  const height = bottom - top;
  // Conteneur trop petit pour deux zones distinctes : pas de défilement
  if (height < EDGE_PX * 2) return 0;
  if (y < top + EDGE_PX) {
    const ratio = Math.min(1, (top + EDGE_PX - y) / EDGE_PX);
    return -Math.ceil(MAX_SPEED * ratio);
  }
  if (y > bottom - EDGE_PX) {
    const ratio = Math.min(1, (y - (bottom - EDGE_PX)) / EDGE_PX);
    return Math.ceil(MAX_SPEED * ratio);
  }
  return 0;
}

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

// `rootRef` : un élément à l'intérieur du conteneur qui défile.
export function useDragAutoScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let y = 0;
    let lastEvent = 0;
    let frame = 0;

    function step() {
      frame = 0;
      if (!scroller || performance.now() - lastEvent > IDLE_MS) return;
      const rect = scroller.getBoundingClientRect();
      const dy = autoScrollDelta(y, rect.top, rect.bottom);
      if (dy !== 0) scroller.scrollTop += dy;
      frame = requestAnimationFrame(step);
    }

    function onDragOver(e: DragEvent) {
      y = e.clientY;
      lastEvent = performance.now();
      // Recherché à chaque événement tant qu'aucun conteneur n'est trouvé
      // (la page peut devenir assez longue pour défiler en cours de route).
      if (!scroller || !scroller.isConnected) {
        scroller = findScrollParent(rootRef.current);
      }
      if (scroller && frame === 0) frame = requestAnimationFrame(step);
    }

    function stop() {
      lastEvent = 0;
      scroller = null;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", stop);
    window.addEventListener("dragend", stop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", stop);
      window.removeEventListener("dragend", stop);
      stop();
    };
  }, [rootRef]);
}

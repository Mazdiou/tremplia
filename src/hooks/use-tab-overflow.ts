"use client";

import { useEffect, useRef, useState } from "react";

// Barre d'onglets qui défile horizontalement (téléphone), sans barre de
// défilement visible : l'onglet ouvert reste visible, et un fondu indique
// de quel côté d'autres onglets sont cachés. `page` : la page ouverte (tout
// est recalculé quand elle change).
export function useTabOverflow<T extends HTMLElement>(page: string) {
  const ref = useRef<T>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const update = () => {
      const left = nav.scrollLeft > 2;
      const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2;
      setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
    };
    // L'onglet ouvert reste visible
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [page]);

  const fadeClass =
    more.left && more.right
      ? "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      : more.right
        ? "[mask-image:linear-gradient(to_right,black_80%,transparent)]"
        : more.left
          ? "[mask-image:linear-gradient(to_right,transparent,black_20%)]"
          : undefined;

  return { ref, fadeClass };
}

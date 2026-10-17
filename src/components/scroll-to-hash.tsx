"use client";

import { useEffect } from "react";

// Ancre d'une adresse (« /settings#campagnes ») : le contenu défile dans
// <main> et non dans la fenêtre, le navigateur et Next n'y vont donc pas
// d'eux-mêmes. À poser dans une page qui reçoit de tels liens.
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}

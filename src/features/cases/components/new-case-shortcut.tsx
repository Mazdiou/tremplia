"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NEW_CASE_LINK_SELECTOR } from "../new-case-link";

// Saisie en cours : Shift+N y écrit un « N » majuscule
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// Shift+N, sur toutes les pages de l'agence, hors saisie : ouvre un nouveau
// dossier dans la campagne du premier bouton « Nouveau dossier » de la page,
// sinon sans campagne. Ctrl+N est réservé par les navigateurs (nouvelle
// fenêtre) et n'arrive jamais à la page.
export function NewCaseShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyN") return;
      // Fenêtre ouverte (recherche, confirmation) : le raccourci ne la quitte pas
      if (e.repeat || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      const link = document.querySelector<HTMLAnchorElement>(NEW_CASE_LINK_SELECTOR);
      router.push(link?.getAttribute("href") ?? "/cases/new");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}

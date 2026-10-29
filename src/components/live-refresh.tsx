"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadClient } from "@/lib/supabase/lazy-client";

// Garde la page à jour sans rechargement : messages non lus, « À traiter »,
// pastilles de l'arbre, tâches confiées par un collègue. Seuls les
// composants serveur sont relus ; ce qui est en cours de saisie reste en place.
//
// Agence (agencyId fourni) : abonnement en temps réel aux messages, aux
// réponses et aux pièces des candidats, et aux tâches de l'agence (filtrés
// par le RLS).
// Les suppressions de tâches arrivent aussi : la table est en identité
// complète, le filtre agency_id s'applique à l'ancienne ligne. Si la
// connexion tombe, une vérification toutes les 30 s prend le relais.
// Candidat (sans compte Supabase) : vérification toutes les minutes.
// Dans les deux cas, la page est relue au retour sur l'onglet.

const FALLBACK_MS = 30_000;
const STUDENT_MS = 60_000;
// Plusieurs événements rapprochés (envoi + lecture) : une seule relecture
const DEBOUNCE_MS = 400;
// Retour sur l'onglet juste après une relecture : inutile d'en refaire une
const MIN_GAP_MS = 5_000;

export function LiveRefresh({ agencyId }: { agencyId?: string }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    let pending: ReturnType<typeof setTimeout> | undefined;
    let live = false;

    const refresh = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        last = Date.now();
        router.refresh();
      }, DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > MIN_GAP_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const timer = setInterval(
      () => {
        if (document.visibilityState !== "visible" || live) return;
        if (Date.now() - last > MIN_GAP_MS) refresh();
      },
      agencyId ? FALLBACK_MS : STUDENT_MS,
    );

    let cleanup = () => {};
    if (agencyId) {
      // Page quittée avant la fin du chargement ou de setAuth : plus
      // d'abonnement à ouvrir, sinon le canal resterait ouvert sans que
      // personne le ferme
      let disposed = false;
      let removeChannel = () => {};
      // Client chargé après l'affichage de la page (voir lazy-client.ts).
      // Chargement en échec (hors ligne) : la vérification périodique suffit.
      void loadClient()
        .then(async (supabase) => {
          if (disposed) return;
          const filter = `agency_id=eq.${agencyId}`;
          const channel = supabase
            .channel(`agency-live:${agencyId}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "case_messages", filter },
              (payload) => {
                // Les messages de l'agence elle-même se rafraîchissent à l'envoi
                if ((payload.new as { sender?: string }).sender === "student") refresh();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "case_student_reviews", filter },
              refresh,
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "case_tasks", filter },
              refresh,
            )
            // Pièce envoyée, remplacée ou retirée par le candidat (mise à
            // jour de la pièce demandée)
            .on(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "case_document_requests", filter },
              refresh,
            );
          removeChannel = () => void supabase.removeChannel(channel);
          // Le jeton de la session doit être transmis avant l'abonnement,
          // sinon le RLS ne laisse rien passer
          await supabase.realtime.setAuth();
          if (disposed) return;
          channel.subscribe((status) => {
            const wasLive = live;
            live = status === "SUBSCRIBED";
            // Reconnexion : rattraper ce qui est arrivé pendant la coupure
            if (live && !wasLive && Date.now() - last > MIN_GAP_MS) refresh();
          });
        })
        .catch(() => {});
      cleanup = () => {
        disposed = true;
        removeChannel();
      };
    }

    return () => {
      clearTimeout(pending);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      cleanup();
    };
  }, [agencyId, router]);

  return null;
}

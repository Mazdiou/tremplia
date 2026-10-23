"use client";

import { useEffect } from "react";
import { keepPushDevice } from "../push-client";

// Posé dans la coquille de l'agence et l'espace candidat : à l'ouverture et
// à chaque retour sur l'appli, l'abonnement de cet appareil (s'il a été
// activé par ce compte) est recréé s'il a disparu. Safari sur iPhone le
// retire parfois sans prévenir.
export function PushKeeper({
  publicKey,
  deviceUrl,
  owner,
}: {
  publicKey: string;
  deviceUrl: string;
  owner: string;
}) {
  useEffect(() => {
    const keep = () => void keepPushDevice({ publicKey, deviceUrl, owner });
    keep();
    const onVisible = () => {
      if (document.visibilityState === "visible") keep();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [publicKey, deviceUrl, owner]);

  return null;
}

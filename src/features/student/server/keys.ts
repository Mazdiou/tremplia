import "server-only";
import { createHmac, hkdfSync } from "node:crypto";
import { serverEnv } from "@/lib/env-server";

// Clés de l'espace candidat, dérivées de la clé de chiffrement du serveur
// (une par usage) : aucune variable d'environnement de plus à configurer.
function derive(usage: string) {
  return Buffer.from(hkdfSync("sha256", serverEnv().externalAccountsKey, "", usage, 32));
}

function hmac(usage: string, value: string) {
  return createHmac("sha256", derive(usage)).update(value).digest("hex");
}

// Empreinte d'un code, seule forme gardée pour la connexion
export function codeLookup(code: string) {
  return hmac("studyflow:student-code", code);
}

// Empreinte d'une adresse IP, pour limiter les essais sans la garder
export function ipHash(ip: string) {
  return hmac("studyflow:student-ip", ip);
}

// Signature du cookie de session du candidat
export function signSession(payload: string) {
  return createHmac("sha256", derive("studyflow:student-session"))
    .update(payload)
    .digest("base64url");
}

// Données chiffrées liées au dossier : une copie dans un autre dossier ne
// se déchiffre pas
export function codeAad(agencyId: string, caseId: string) {
  return `student-code:${agencyId}:${caseId}`;
}

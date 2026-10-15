// Adresse IP du visiteur, pour les limites d'essais (jamais gardée en clair).
//
// Elle vient d'un en-tête posé par l'hébergeur, réglable par CLIENT_IP_HEADER
// (par défaut x-forwarded-for). Pour x-forwarded-for, on prend la DERNIÈRE
// adresse : c'est celle qu'ajoute le dernier relais (Vercel, nginx…) ; les
// précédentes peuvent venir du visiteur lui-même. Derrière un CDN, choisir
// l'en-tête du CDN (cf-connecting-ip pour Cloudflare, par exemple).
// Sans x-forwarded-for, x-real-ip (posé par nginx) sert de repli : sinon
// tous les visiteurs partageraient la même adresse « inconnue » et se
// bloqueraient les uns les autres.
export function clientIp(
  request: Request,
  header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || "x-forwarded-for",
): string {
  const value = request.headers.get(header);
  if (header === "x-forwarded-for") {
    const last = value?.split(",").at(-1)?.trim();
    return last || request.headers.get("x-real-ip")?.trim() || "inconnue";
  }
  return value?.trim() || "inconnue";
}

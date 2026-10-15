// Adresse IP du visiteur, pour les limites d'essais (jamais gardée en clair).
//
// Elle vient d'un en-tête posé par l'hébergeur, réglable par CLIENT_IP_HEADER
// (par défaut x-forwarded-for). Pour x-forwarded-for, on prend la DERNIÈRE
// adresse : c'est celle qu'ajoute le dernier relais (Vercel, nginx…) ; les
// précédentes peuvent venir du visiteur lui-même. Derrière un CDN, choisir
// l'en-tête du CDN (cf-connecting-ip pour Cloudflare, par exemple).
export function clientIp(
  request: Request,
  header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || "x-forwarded-for",
): string {
  const value = request.headers.get(header);
  const ip = (header === "x-forwarded-for" ? value?.split(",").at(-1) : value)?.trim();
  return ip || "inconnue";
}

// Lien d'appel d'un numéro saisi librement : « 0555 12 34 56 » → tel:0555123456
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

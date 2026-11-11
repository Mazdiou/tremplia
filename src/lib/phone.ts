// Lien d'appel d'un numéro saisi librement : « 0555 12 34 56 » → tel:0555123456
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

// Numéro algérien saisi librement, affiché par groupes : « 0552753559 » →
// « 05 52 75 35 59 », « 026123456 » → « 026 12 34 56 ». Tout autre format
// (étranger, incomplet) est rendu tel quel.
export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (/^\+/.test(phone.trim()) || !digits.startsWith("0")) return phone.trim();
  if (digits.length === 10) return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return phone.trim();
}

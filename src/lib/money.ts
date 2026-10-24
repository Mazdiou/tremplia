// Montants en dinars, toujours entiers. La base impose la même limite
// (fonction is_valid_amount).
export const MAX_AMOUNT = 999_999_999;

const daFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// Espaces : fine insécable (U+202F, celle du format français) et insécable
// normale (U+00A0)
const NARROW_NBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0xa0);

// « 150 000 DA » (espaces insécables : le montant ne se coupe jamais).
// L'espace fine insécable du format français est remplacée par une espace
// insécable normale : avec la police de l'appli, la fine est presque
// invisible (« 11670000 DA »).
export function formatDA(amount: number) {
  return `${daFormat.format(amount).replaceAll(NARROW_NBSP, NBSP)}${NBSP}DA`;
}

// Saisie d'un montant : chiffres, espaces et points de milliers acceptés
// (« 150 000 », « 150.000 »). null : champ vide ; NaN : saisie invalide.
export function parseAmount(input: string): number | null {
  const compact = input.replace(/[\s\u00a0\u202f.]/g, "");
  if (compact === "") return null;
  if (!/^\d{1,9}$/.test(compact)) return Number.NaN;
  return Number(compact);
}

// Valeur affichée dans un champ de saisie : « 150 000 »
export function amountInputValue(amount: number | null | undefined) {
  return amount == null ? "" : daFormat.format(amount).replace(/[\u00a0\u202f]/g, " ");
}

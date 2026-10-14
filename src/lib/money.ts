// Montants en dinars, toujours entiers. La base impose la même limite
// (fonction is_valid_amount).
export const MAX_AMOUNT = 999_999_999;

const daFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// « 150 000 DA » (espaces insécables : le montant ne se coupe jamais)
export function formatDA(amount: number) {
  return `${daFormat.format(amount)} DA`;
}

// Saisie d'un montant : chiffres, espaces et points de milliers acceptés
// (« 150 000 », « 150.000 »). null : champ vide ; NaN : saisie invalide.
export function parseAmount(input: string): number | null {
  const compact = input.replace(/[\s  .]/g, "");
  if (compact === "") return null;
  if (!/^\d{1,9}$/.test(compact)) return Number.NaN;
  return Number(compact);
}

// Valeur affichée dans un champ de saisie : « 150 000 »
export function amountInputValue(amount: number | null | undefined) {
  return amount == null ? "" : daFormat.format(amount).replace(/[  ]/g, " ");
}

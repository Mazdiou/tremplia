import { randomInt } from "node:crypto";

// Code d'accès du candidat : 8 caractères sans ceux qui se confondent
// (0/O, 1/I/L), affiché en deux blocs : K7P4-9XQM. 31^8 ≈ 850 milliards de
// codes ; les essais sont de plus limités par adresse (student_login).
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Saisie du candidat : majuscules, sans espaces ni tirets. null si ce ne peut
// pas être un code (inutile d'interroger la base).
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

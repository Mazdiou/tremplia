// Pour comparer des noms sans tenir compte de la casse, des accents
// ni des espaces multiples : « Éloïse  DUPONT » = « eloise dupont ».
export function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Initiales d'un avatar : « BS » pour Sara Benali
export function initialsOf(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

// « NOM Prénom », partout dans l'interface
export function displayName(firstName: string, lastName: string) {
  return `${lastName.toLocaleUpperCase("fr")} ${firstName}`;
}

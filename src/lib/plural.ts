// Accord en nombre : 0 et 1 au singulier, comme en français. Le pluriel est
// donné en entier quand il ne suffit pas d'ajouter un « s » à la fin
// (« message non lu » → « messages non lus »).

// « dossiers actifs », sans le nombre
export function pluralWord(n: number, one: string, many = `${one}s`) {
  return n > 1 ? many : one;
}

// « 3 dossiers actifs »
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${pluralWord(n, one, many)}`;
}

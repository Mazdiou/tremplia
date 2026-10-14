// Plateformes proposées pour un compte externe : plusieurs listes fusionnées
// dans l'ordre, sans doublon, majuscules ignorées (« Pastel » = « PASTEL »).
export function mergePlatforms(...lists: string[][]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of lists.flat()) {
    const key = p.toLocaleLowerCase("fr");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

// Supabase renvoie au plus 1000 lignes par requête (réglage max_rows) : lecture
// par pages de 500, triées sur une colonne stable, jusqu'à la dernière. Sert au
// serveur comme au navigateur ; lève une erreur si une page échoue.
const PAGE_SIZE = 500;

export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("lecture impossible");
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

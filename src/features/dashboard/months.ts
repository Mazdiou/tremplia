// Premiers jours des n derniers mois, du plus ancien au mois de `today`
// compris (AAAA-MM-JJ, comme la vue payment_months)
export function lastMonths(today: string, n: number): string[] {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(year, month - 1 - (n - 1 - i), 1)).toISOString().slice(0, 10),
  );
}

// Jours entiers écoulés entre deux jours (AAAA-MM-JJ)
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

"use client";

import { useRouter } from "next/navigation";

// Sélecteur du tableau de bord : toutes les campagnes actives ou une seule.
// Le choix passe dans l'adresse (identifiant de campagne, aucune donnée
// personnelle), ce qui permet de le partager ou de le mettre en favori.
export function CampaignSelect({
  campaigns,
  value,
}: {
  campaigns: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Afficher</span>
      <select
        value={value}
        onChange={(e) =>
          router.push(e.target.value ? `/dashboard?campaign=${e.target.value}` : "/dashboard")
        }
        className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Toutes les campagnes actives</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

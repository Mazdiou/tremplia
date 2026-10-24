"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadClient } from "@/lib/supabase/lazy-client";
import { pausePushDevice } from "@/features/notifications/push-client";

// Déconnexion de cet appareil. Sur téléphone, c'est ici que se trouve
// « Se déconnecter ».
export function SessionActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    // Plus de notifications du compte ici jusqu'à sa prochaine connexion
    await pausePushDevice("/api/push/device");
    const supabase = await loadClient();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={loading} onClick={() => void signOut()}>
      <LogOut /> Se déconnecter
    </Button>
  );
}

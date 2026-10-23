"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { forgetPushDevice } from "@/features/notifications/push-client";

// Déconnexion de cet appareil. Sur téléphone, c'est ici que se trouve
// « Se déconnecter ».
export function SessionActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    // Cet appareil ne reçoit plus les notifications du compte
    await forgetPushDevice("/api/push/device");
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={loading} onClick={() => void signOut()}>
      <LogOut /> Se déconnecter
    </Button>
  );
}

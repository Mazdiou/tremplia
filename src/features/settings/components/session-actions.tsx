"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// Déconnexion de cet appareil. Sur téléphone, c'est ici que se trouve
// « Se déconnecter ».
export function SessionActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
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

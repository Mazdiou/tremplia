"use client";

import Link from "next/link";
import { Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowserValue } from "@/hooks/use-browser-value";
import { useUiPrefs } from "@/lib/ui-prefs";

// Nouveau dossier (patron, page d'inscription fermée) : rappelle que les
// candidats peuvent saisir eux-mêmes ces informations. Masqué pour de bon
// sur cet appareil par la croix ; affiché seulement après le chargement,
// pour ne pas apparaître un instant chez qui l'a déjà masqué.
export function SignupHint() {
  const [prefs, setPrefs] = useUiPrefs();
  const ready = useBrowserValue(() => true);
  if (!ready || prefs.signupHintHidden) return null;

  return (
    <aside
      aria-label="Inscription en ligne"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-highlight p-4 text-sm"
    >
      <Globe className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Gagnez du temps : laissez vos candidats s&apos;inscrire</p>
        <p className="mt-1 text-muted-foreground">
          Ouvrez votre page d&apos;inscription en ligne et partagez-la sur Facebook ou WhatsApp :
          les candidats y saisissent eux-mêmes ces informations, vous n&apos;avez plus qu&apos;à
          vérifier.
        </p>
        <Link
          href="/settings#inscription"
          className="mt-2 inline-block font-medium text-link underline-offset-2 hover:underline"
        >
          Ouvrir ma page
        </Link>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="-mt-1 -mr-1 text-muted-foreground"
        aria-label="Ne plus afficher"
        title="Ne plus afficher"
        onClick={() => setPrefs({ signupHintHidden: true })}
      >
        <X />
      </Button>
    </aside>
  );
}

import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmLink, type LinkType } from "@/features/auth/components/confirm-link";

export const metadata: Metadata = { title: "Lien reçu par e-mail" };

// Lien reçu par e-mail (mot de passe oublié, confirmation de l'adresse). Le
// jeton n'est utilisé qu'au clic sur le bouton : les messageries qui
// ouvrent les liens pour les analyser ne le consomment pas.
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type: LinkType | null =
    params.type === "recovery" || params.type === "email" ? params.type : null;
  const valid = /^[0-9a-f]{20,128}$/i.test(tokenHash) && type !== null;

  return (
    <AuthShell>
      <ConfirmLink tokenHash={valid ? tokenHash : null} type={type ?? "email"} />
    </AuthShell>
  );
}

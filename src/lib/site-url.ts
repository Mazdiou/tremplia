import { BRAND } from "@/config/brand";

// Adresse publique du site, sans « / » final : liens des e-mails, aperçus
// des liens partagés, plan du site. Jamais tirée de la requête (en-tête
// Host) : un lien de mot de passe oublié ne doit pas pouvoir pointer
// ailleurs. SITE_URL la remplace (local : http://127.0.0.1:3000).
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const value = env.SITE_URL?.trim();
  if (!value) return BRAND.url;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return BRAND.url;
    return url.origin;
  } catch {
    return BRAND.url;
  }
}

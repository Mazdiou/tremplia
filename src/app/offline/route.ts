import { BRAND } from "@/config/brand";
import { cairnSvg } from "@/components/logo-mark";

// Page « Pas de connexion », gardée par le service worker (public/sw.js) et
// affichée quand le réseau manque. Une page HTML autonome : styles en ligne,
// aucun fichier à charger, puisqu'elle s'affiche justement hors connexion.
export const dynamic = "force-static";

const { primary, background, backgroundDark } = BRAND.colors;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Pas de connexion – ${BRAND.name}</title>
<style>
  :root { color-scheme: light dark; --bg: ${background}; --fg: #1e293b; --muted: #64748b; --card: #fff; --border: #e2e8f0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: ${backgroundDark}; --fg: #f1f5f9; --muted: #94a3b8; --card: #161a20; --border: #262b33; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center;
    padding: 24px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left));
    background: var(--bg); color: var(--fg);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  main { width: 100%; max-width: 360px; text-align: center; }
  .logo { width: 56px; height: 56px; margin: 0 auto 20px; border-radius: 16px; background: ${primary}; display: grid; place-items: center; }
  h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.01em; }
  p { margin: 0 0 24px; color: var(--muted); }
  a {
    display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 24px;
    border-radius: 12px; background: ${primary}; color: #fff; font-weight: 600; text-decoration: none;
  }
</style>
</head>
<body>
<main>
  <div class="logo" aria-hidden="true">
    ${cairnSvg(32)}
  </div>
  <h1>Pas de connexion</h1>
  <p>${BRAND.name} a besoin d'internet pour afficher vos dossiers. Vérifiez votre réseau, puis réessayez.</p>
  <a href="" onclick="location.reload(); return false;">Réessayer</a>
</main>
<script>window.addEventListener("online", function () { location.reload(); });</script>
</body>
</html>`;

export function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

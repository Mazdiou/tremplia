import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Pages publiques. Une personne déjà connectée qui les ouvre est envoyée sur
// son tableau de bord (la page d'accueil « / » comprise).
const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password"];

// Ouvertes avec ou sans session : lien reçu par e-mail (un patron déjà
// connecté peut ouvrir le lien de confirmation d'un autre appareil) et
// pages légales
const OPEN_PATHS = ["/auth/confirm", "/mentions-legales", "/conditions", "/confidentialite"];

// Espace candidat : sa propre session (cookie signé), vérifiée par ses pages
// et ses routes. La session des employés n'y est pas consultée.
function isStudentPath(path: string) {
  return /^\/(api\/)?student(\/|$)/.test(path);
}

export async function proxy(request: NextRequest) {
  if (isStudentPath(request.nextUrl.pathname) || OPEN_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const env = publicEnv();
  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Jeton vérifié sur place (clés de signature asymétriques) : pas d'appel
  // au serveur d'authentification à chaque page. Le profil, lu juste après,
  // écarte toujours un compte désactivé.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);
  const isApi = path.startsWith("/api/");

  function redirectTo(target: string) {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  // Visiteur non connecté
  if (!userId) {
    if (!isPublic && !isApi) return redirectTo("/login");
    return response;
  }

  // Les routes API vérifient elles-mêmes l'appelant
  if (isApi) return response;

  // Le RLS ne renvoie aucun profil à un compte désactivé (ou sans profil)
  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    // Sur une page publique on ne redirige pas : aucune boucle possible
    return isPublic ? response : redirectTo("/login");
  }

  if (isPublic) return redirectTo("/dashboard");

  // Mot de passe temporaire : tout est bloqué sauf la page de changement
  const mustChange = profile.must_change_password === true;
  if (mustChange && path !== "/change-password") {
    return redirectTo("/change-password");
  }
  if (!mustChange && path === "/change-password") {
    return redirectTo("/dashboard");
  }

  return response;
}

export const config = {
  // Fichiers de l'application installable (manifeste, icônes, service
  // worker, page hors connexion), fichiers pour les moteurs de recherche et
  // les aperçus de liens, routes publiques de l'API (inscription, e-mails,
  // tâches planifiées, tunnel du suivi des erreurs) : publics, sans session
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/register|api/auth/forgot-password|api/auth/confirmation|api/cron/|api/rapport|manifest.webmanifest|sw.js|icons/|icon|apple-icon|offline|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};

import { MAX_ENVELOPE_BYTES, tunnelTarget } from "@/lib/sentry-tunnel";

// Tunnel du suivi des erreurs (voir src/lib/sentry-tunnel.ts). Public : les
// erreurs viennent aussi de la page de connexion et de l'espace candidat.
// Rien n'est écrit dans les logs ni gardé ; la base n'est jamais lue.
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_ENVELOPE_BYTES) return new Response(null, { status: 413 });

  // Sans longueur annoncée, la plateforme limite déjà le corps (4,5 Mo sur
  // Vercel) : on le lit puis on le mesure
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_ENVELOPE_BYTES) {
    return new Response(null, { status: 413 });
  }

  const target = tunnelTarget(body, process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!target) return new Response(null, { status: 400 });

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });
    // Consignes de Sentry (quota atteint, attendre) : le navigateur ralentit
    // ses envois en les lisant
    const headers = new Headers();
    for (const name of ["retry-after", "x-sentry-rate-limits"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(null, { status: upstream.status, headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}

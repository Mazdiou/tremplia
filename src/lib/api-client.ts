// Appel d'une route de l'API depuis le navigateur. Ne lève jamais : une
// coupure réseau devient un message d'erreur, comme une réponse en erreur,
// pour qu'aucun bouton ne reste bloqué sur « Enregistrement… ».

type Json = Record<string, unknown>;

export type ApiResult<T = Json> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      // Premier message d'erreur de chaque champ (« dates.0.label »)
      fieldErrors: Record<string, string>;
      data: Json | null;
    };

export const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau et réessayez.";

export async function callApi<T = Json>(
  url: string,
  { method = "POST", body }: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR, fieldErrors: {}, data: null };
  }

  const data = (await res.json().catch(() => null)) as Json | null;
  if (res.ok) return { ok: true, data: (data ?? {}) as T };

  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(data?.fields)) {
    for (const f of data.fields as { path: string; message: string }[]) {
      fieldErrors[f.path] ??= f.message;
    }
  }
  return {
    ok: false,
    error: typeof data?.error === "string" ? data.error : `Erreur ${res.status}`,
    fieldErrors,
    data,
  };
}

// Pour une action sans réponse utile : le message d'erreur, ou null si tout
// s'est bien passé
export async function callApiError(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<string | null> {
  const res = await callApi(url, options);
  return res.ok ? null : res.error;
}

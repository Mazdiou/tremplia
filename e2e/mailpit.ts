import { expect } from "@playwright/test";

// Boîte de test du Supabase local (Mailpit) : l'application y envoie ses
// e-mails quand MAILPIT_URL est réglé (.env.local)
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

// Chemin du lien /auth/confirm du dernier e-mail reçu par `to` dont le
// sujet contient `subject` (attendu jusqu'à 15 secondes)
export async function emailLink(to: string, subject: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=1`);
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages?.length) return null;
        const message = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
        const { Text } = (await message.json()) as { Text: string };
        const match = Text.match(/https?:\/\/[^\s]+(\/auth\/confirm\?token_hash=[0-9a-f]+&type=[a-z]+)/);
        link = match?.[1] ?? null;
        return link;
      },
      { timeout: 15_000, message: `e-mail « ${subject} » pour ${to}` },
    )
    .not.toBeNull();
  return link!;
}

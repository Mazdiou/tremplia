// Restauration : renvoie dans le stockage Supabase les fichiers d'une
// sauvegarde (un sous-dossier par bucket, comme storage-download.mjs les
// range). Les buckets doivent exister : ils reviennent avec la base.
//
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup/storage-upload.mjs <dossier>

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [source] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!source || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Usage : SUPABASE_URL=… SUPABASE_SECRET_KEY=… node storage-upload.mjs <dossier>");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const CONTENT_TYPES = { ".pdf": "application/pdf" };

let total = 0;
for (const bucket of await readdir(source, { withFileTypes: true })) {
  if (!bucket.isDirectory()) continue;
  const root = path.join(source, bucket.name);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    const key = path.relative(root, full).split(path.sep).join("/");
    // upsert : la ligne de storage.objects est déjà revenue avec la base
    const { error } = await supabase.storage.from(bucket.name).upload(key, await readFile(full), {
      upsert: true,
      contentType: CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream",
    });
    if (error) throw new Error(`envoi de ${bucket.name}/${key} : ${error.message}`);
    count++;
  }
  console.log(`${bucket.name} : ${count} fichier(s)`);
  total += count;
}
console.log(`Total : ${total} fichier(s)`);

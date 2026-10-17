// Copie de tous les fichiers du stockage Supabase dans un dossier local,
// bucket par bucket, chemins conservés. Sert à la sauvegarde nocturne
// (.github/workflows/sauvegarde.yml).
//
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup/storage-download.mjs <dossier>

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [target] = process.argv.slice(2);
// Un espace ou un retour à la ligne collé avec un secret le rend invalide
const SUPABASE_URL = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY?.trim();
if (!target || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Usage : SUPABASE_URL=… SUPABASE_SECRET_KEY=… node storage-download.mjs <dossier>");
  process.exit(2);
}

// Diagnostic sans rien révéler : projet visé et sorte de clé
const keyKind = SUPABASE_SECRET_KEY.startsWith("sb_secret_")
  ? "clé secrète (sb_secret_…)"
  : SUPABASE_SECRET_KEY.startsWith("sb_publishable_")
    ? "clé PUBLIQUE (sb_publishable_…) : il faut la clé secrète"
    : SUPABASE_SECRET_KEY.startsWith("eyJ")
      ? "ancienne clé JWT (service_role ou anon)"
      : "format inconnu";
console.log(`Stockage de ${new URL(SUPABASE_URL).host}, avec une ${keyKind}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const PAGE = 1000;

// Tous les fichiers sous un préfixe : list() ne renvoie qu'un niveau, les
// sous-dossiers arrivent sans id
async function listFiles(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`liste de ${bucket}/${prefix} : ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(full);
      else files.push(...(await listFiles(bucket, full)));
    }
    if (data.length < PAGE) return files;
  }
}

const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) {
  throw new Error(
    `liste des buckets : ${error.message}. Vérifier que SUPABASE_SECRET_KEY est la clé secrète ` +
      "du même projet que SUPABASE_URL (Project Settings → API Keys), collée sans espace.",
  );
}

// Quelques téléchargements à la fois : plus rapide, sans saturer l'API
const PARALLEL = 8;

async function download(bucket, file) {
  const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(file);
  if (downloadError) throw new Error(`téléchargement de ${bucket}/${file} : ${downloadError.message}`);
  const dest = path.join(target, bucket, ...file.split("/"));
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await blob.arrayBuffer()));
}

let total = 0;
for (const bucket of buckets) {
  const files = await listFiles(bucket.id);
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < files.length) await download(bucket.id, files[next++]);
    }),
  );
  console.log(`${bucket.id} : ${files.length} fichier(s)`);
  total += files.length;
}
console.log(`Total : ${total} fichier(s)`);

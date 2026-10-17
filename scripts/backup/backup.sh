#!/usr/bin/env bash
# Sauvegarde complète dans une archive chiffrée : base (schéma, données,
# comptes, historique des migrations) et fichiers du stockage. Seule la clé
# privée age, gardée hors ligne, peut l'ouvrir. Lancée chaque nuit par
# .github/workflows/sauvegarde.yml ; restauration : scripts/backup/restore.sh.
#
#   SUPABASE_DB_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… \
#   BACKUP_AGE_RECIPIENT=age1… scripts/backup/backup.sh <archive.tar.gz.age>
#
# BACKUP_AGE_RECIPIENT peut contenir plusieurs clés publiques séparées par
# des espaces : chacune pourra ouvrir l'archive.
set -euo pipefail

out="${1:?Usage : backup.sh <archive.tar.gz.age>}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant}"
: "${SUPABASE_URL:?SUPABASE_URL manquant}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY manquant}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT manquant}"

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dir="$work/sauvegarde"
mkdir -p "$dir"

# Tables internes de Supabase, vides ici et refusées à la restauration
excluded="storage.buckets_analytics,storage.buckets_vectors,storage.vector_indexes,storage.iceberg_namespaces,storage.iceberg_tables,storage.s3_multipart_uploads,storage.s3_multipart_uploads_parts"

dump() { npx supabase db dump --db-url "$SUPABASE_DB_URL" "$@"; }

# Réglages des rôles : gardés pour mémoire, ceux d'un projet neuf suffisent
dump --role-only -f "$dir/roles.sql"
dump -f "$dir/schema.sql"
dump --data-only --use-copy -x "$excluded" -f "$dir/data.sql"
dump -s supabase_migrations -f "$work/migrations-schema.sql"
dump -s supabase_migrations --data-only --use-copy -f "$work/migrations-data.sql"
cat "$work/migrations-schema.sql" "$work/migrations-data.sql" > "$dir/migrations.sql"

node "$here/storage-download.mjs" "$dir/storage" | tee "$dir/fichiers.txt"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$dir/date.txt"

recipients=()
for r in $BACKUP_AGE_RECIPIENT; do recipients+=(-r "$r"); done
tar -czf - -C "$work" sauvegarde | age "${recipients[@]}" -o "$out"
echo "Archive chiffrée : $out ($(du -h "$out" | cut -f1))"

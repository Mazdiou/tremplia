#!/usr/bin/env bash
# Restauration d'une archive de backup.sh dans un projet Supabase NEUF (vide :
# aucune migration appliquée). Base d'abord, puis fichiers du stockage.
#
#   SUPABASE_DB_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… \
#   scripts/backup/restore.sh <archive.tar.gz.age> <clé-privée-age.txt>
#
# psql est nécessaire. Sans psql installé, passer par Docker :
#   PSQL="docker run --rm -i postgres:17 psql" scripts/backup/restore.sh …
set -euo pipefail

archive="${1:?Usage : restore.sh <archive.tar.gz.age> <clé-privée-age.txt>}"
identity="${2:?Usage : restore.sh <archive.tar.gz.age> <clé-privée-age.txt>}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant}"
: "${SUPABASE_URL:?SUPABASE_URL manquant}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY manquant}"
psql_cmd="${PSQL:-psql}"

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

age -d -i "$identity" "$archive" | tar -xzf - -C "$work"
dir="$work/sauvegarde"
echo "Sauvegarde du $(cat "$dir/date.txt")"

# Tout en une transaction : en cas d'erreur, la base reste vide. Les
# déclencheurs sont suspendus pendant le chargement des données (sinon le
# journal et les contrôles d'abonnement réagiraient à chaque ligne).
{
  cat "$dir/schema.sql"
  echo "SET session_replication_role = replica;"
  cat "$dir/data.sql"
  echo "SET session_replication_role = origin;"
  cat "$dir/migrations.sql"
} | $psql_cmd --single-transaction -v ON_ERROR_STOP=1 -q -d "$SUPABASE_DB_URL" > /dev/null
echo "Base restaurée"

# Contrôle : chaque table a autant de lignes que dans la sauvegarde
"$here/count-rows.sh" "$dir/data.sql" > "$work/attendu.txt"
query="$(awk '{ printf "%sselect %s, count(*) from %s\n", (NR > 1 ? "union all " : ""), "'\''" $1 "'\''", $1 }' "$work/attendu.txt")"
echo "$query;" | $psql_cmd -tA -F ' ' -d "$SUPABASE_DB_URL" | sort > "$work/obtenu.txt"
if ! diff "$work/attendu.txt" "$work/obtenu.txt"; then
  echo "ÉCHEC : nombres de lignes différents (attendu à gauche, obtenu à droite)" >&2
  exit 1
fi
echo "Contrôle : $(wc -l < "$work/attendu.txt") tables identiques à la sauvegarde"

node "$here/storage-upload.mjs" "$dir/storage"
echo "Restauration terminée"

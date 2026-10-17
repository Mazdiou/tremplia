#!/usr/bin/env bash
# Nombre de lignes par table dans un data.sql de backup.sh (blocs COPY),
# trié : « "public"."cases" 415 ». Sert à vérifier une restauration.
#
#   scripts/backup/count-rows.sh <data.sql>
set -euo pipefail
awk '
  /^COPY / { table = $2; n = 0; inside = 1; next }
  inside && /^\\\.$/ { print table, n; inside = 0; next }
  inside { n++ }
' "${1:?Usage : count-rows.sh <data.sql>}" | sort

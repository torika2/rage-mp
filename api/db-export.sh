#!/usr/bin/env bash
#
# Export the current RAGE:MP database (schema + data) into seed.sql.
# Run this whenever you want to share your local DB state with other developers.
#
#   ./db-export.sh
#
# Then commit the regenerated seed.sql. Other developers load it with ./db-import.sh.
# Credentials are read from .env (never hardcoded here).

set -euo pipefail
cd "$(dirname "$0")"

# Load DB_* vars from .env
set -a
# shellcheck disable=SC1091
source .env
set +a

OUT="seed.sql"

# Tables to skip. 'users' holds account password hashes / personal data —
# uncomment the next line if you do NOT want to share real accounts.
EXCLUDE_TABLES=(fraud_log)
# EXCLUDE_TABLES=(fraud_log users)

IGNORE_ARGS=()
for table in "${EXCLUDE_TABLES[@]}"; do
  IGNORE_ARGS+=("--ignore-table=${DB_NAME}.${table}")
done

echo "Dumping ${DB_NAME} -> ${OUT} ..."

mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --no-tablespaces \
  --single-transaction \
  --skip-extended-insert \
  --add-drop-table \
  --databases "${DB_NAME}" \
  "${IGNORE_ARGS[@]}" \
  > "${OUT}"

echo "Done. Wrote $(wc -l < "${OUT}") lines to ${OUT}."
echo "Commit ${OUT} so other developers can load it with ./db-import.sh"

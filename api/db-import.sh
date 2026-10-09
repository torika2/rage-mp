#!/usr/bin/env bash
#
# Load seed.sql (produced by ./db-export.sh) into your local MySQL.
# Use this after cloning the repo, or whenever you want to reset your DB
# to the shared dataset.
#
#   ./db-import.sh
#
# WARNING: seed.sql uses DROP TABLE / CREATE — existing data in those tables
# is replaced. Credentials are read from .env.

set -euo pipefail
cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source .env
set +a

IN="seed.sql"
[ -f "${IN}" ] || { echo "No ${IN} found. Ask a teammate to run ./db-export.sh first."; exit 1; }

echo "Importing ${IN} into ${DB_NAME} ..."

mysql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  < "${IN}"

echo "Done. ${DB_NAME} now matches ${IN}."

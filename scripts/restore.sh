#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file>"
  echo "  e.g. ./scripts/restore.sh backups/digital_khata_20260830_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will overwrite the database '${PGDATABASE:-digital_khata}' with ${BACKUP_FILE}"
read -rp "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring from ${BACKUP_FILE}..."

gunzip -c "$BACKUP_FILE" | psql --quiet

echo "Restore complete."

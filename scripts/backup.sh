#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/digital_khata_${TIMESTAMP}.sql.gz"

echo "Backing up database '${PGDATABASE:-digital_khata}' to ${BACKUP_FILE}..."

pg_dump --format=plain --clean --if-exists --no-owner --no-privileges | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: ${BACKUP_FILE} (${SIZE})"

echo "Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "digital_khata_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Done."

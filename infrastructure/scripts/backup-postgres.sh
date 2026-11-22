#!/usr/bin/env bash

set -Eeuo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
environment_file=${1:-"${project_root}/.env.production"}
compose_file="${project_root}/compose.production.yaml"

if [[ ! -f "${environment_file}" ]]; then
  printf 'Environment file not found: %s\n' "${environment_file}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${environment_file}"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${STORAGE_BUCKET:?STORAGE_BUCKET is required}"
: "${STORAGE_REGION:?STORAGE_REGION is required}"

timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
backup_uri="s3://${STORAGE_BUCKET}/backups/postgresql/mediagnostics-${timestamp}.dump"

docker compose \
  --env-file "${environment_file}" \
  --file "${compose_file}" \
  exec --no-TTY postgres \
  pg_dump \
  --username "${POSTGRES_USER}" \
  --format custom \
  --compress 9 \
  --no-owner \
  --no-privileges \
  "${POSTGRES_DB}" \
  | aws s3 cp - "${backup_uri}" \
    --region "${STORAGE_REGION}" \
    --sse AES256 \
    --only-show-errors

printf 'PostgreSQL backup uploaded: %s\n' "${backup_uri}"


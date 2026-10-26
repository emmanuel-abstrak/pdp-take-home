#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'kill 0' EXIT

export PHP_CLI_SERVER_WORKERS=4

if command -v php >/dev/null; then
  php -S 127.0.0.1:8000 legacy-php/index.php &
else
  docker run --rm -p 127.0.0.1:8000:8000 -e PHP_CLI_SERVER_WORKERS -e LEGACY_DELAY_MS -e LEGACY_DOWN \
    -v "$PWD/legacy-php:/app:ro" php:8.4-cli php -S 0.0.0.0:8000 /app/index.php &
fi

[ -d next-app/node_modules ] || npm --prefix next-app ci
npm --prefix next-app run dev -- -p "${PORT:-3009}"

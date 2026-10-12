#!/usr/bin/env bash
#
# Boots the repository's own nginx.conf against a real ./dist and runs the
# header assertions against it.
#
# Only the two directives that can't be shared with a live server are rehomed
# — `listen` (to an unprivileged port) and `root` (to ./dist) — so every rule
# under test is the one that ships in the image. The assertions themselves
# live in verify-headers.sh, which is URL-driven: the same list can be run
# against a staging or production deployment, so a CDN's header policy can't
# drift away from nginx.conf.
#
# Usage: scripts/verify-nginx.sh [port]       (expects `npx vite build` first)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO_ROOT/dist"
CONF="$REPO_ROOT/nginx.conf"
PORT="${1:-8089}"
BASE="http://127.0.0.1:$PORT"

command -v nginx >/dev/null || {
  echo "nginx not found on PATH — install it (e.g. apt-get install nginx-light)" >&2
  exit 1
}
[[ -d $DIST ]] || {
  echo "$DIST missing — run 'npx vite build' first" >&2
  exit 1
}

WORK="$(mktemp -d)"
# Only ever called by the EXIT trap below, which shellcheck can't see through.
# shellcheck disable=SC2317
cleanup() {
  if [[ -f $WORK/nginx.pid ]]; then
    nginx -c "$WORK/nginx.conf" -e "$WORK/error.log" -s quit 2>/dev/null || kill "$(cat "$WORK/nginx.pid")" 2>/dev/null || true
    sleep 0.3
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

# Rehome `listen` and `root`; everything else is used verbatim.
sed -e "s|listen 80;|listen 127.0.0.1:$PORT;|" \
  -e "s|root /usr/share/nginx/html;|root $DIST;|" \
  "$CONF" >"$WORK/server.conf"

mime_types=/etc/nginx/mime.types
[[ -f $mime_types ]] || mime_types=/usr/local/nginx/conf/mime.types

cat >"$WORK/nginx.conf" <<CONFEOF
pid $WORK/nginx.pid;
error_log $WORK/error.log warn;
events { worker_connections 64; }
http {
    include $mime_types;
    default_type application/octet-stream;
    access_log $WORK/access.log;
    client_body_temp_path $WORK/client_body;
    proxy_temp_path $WORK/proxy;
    fastcgi_temp_path $WORK/fastcgi;
    uwsgi_temp_path $WORK/uwsgi;
    scgi_temp_path $WORK/scgi;
    include $WORK/server.conf;
}
CONFEOF

echo "== nginx -t =="
nginx -c "$WORK/nginx.conf" -e "$WORK/error.log" -t
nginx -c "$WORK/nginx.conf" -e "$WORK/error.log"

for _ in $(seq 1 50); do
  curl -fsS -o /dev/null "$BASE/" 2>/dev/null && break
  sleep 0.1
done

# A failed assertion must fail this run, and `cleanup` still stops nginx on
# the way out.
status=0
bash "$REPO_ROOT/scripts/verify-headers.sh" "$BASE" || status=$?

# nginx-only, so it lives here rather than in verify-headers.sh: nginx.conf
# makes /404.html `internal`, so a direct request must be a 404. The shared
# script also accepts a 200 marked noindex, which is right for a host that
# serves static files by path but would let a dropped `internal` slip by here.
echo
echo "== nginx only =="
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/404.html")"
if [[ $code == 404 ]]; then
  printf '  \033[32mok\033[0m   %s\n' "/404.html is internal: a direct request is a 404"
else
  printf '  \033[31mFAIL\033[0m %s\n       %s\n' "/404.html is internal" "$BASE/404.html: status expected 404, got $code" >&2
  status=1
fi
exit "$status"

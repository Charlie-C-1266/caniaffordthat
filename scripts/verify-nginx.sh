#!/usr/bin/env bash
#
# Checks the behaviour nginx.conf is supposed to give the self-hosted build:
# compression, cache headers, security headers, and a real 404 for unknown
# paths instead of the SPA fallback.
#
# Runs the repository's own nginx.conf against a real ./dist, rehoming only
# the two directives that can't be shared with a live server — `listen` (to an
# unprivileged port) and `root` (to ./dist) — so every rule under test is the
# one that ships in the image.
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

# A hashed asset, taken from the real build output.
ASSET_FILE="$(find "$DIST/assets" -name '*.js' -printf '%f\n' | sort | head -1)"
ASSET="/assets/$ASSET_FILE"

FAILED=0
pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() {
  printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2" >&2
  FAILED=1
}

# Asserts an HTTP status for a path, with optional extra curl args.
expect_status() {
  local label=$1 path=$2 want=$3
  shift 3
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' "$@" "$BASE$path")"
  if [[ $got == "$want" ]]; then
    pass "$label ($path -> $got)"
  else
    fail "$label" "$path: expected $want, got $got"
  fi
}

# Asserts a response header matches a regex.
expect_header() {
  local label=$1 path=$2 header=$3 regex=$4
  shift 4
  local got
  got="$(curl -sS -D - -o /dev/null "$@" "$BASE$path" |
    tr -d '\r' | grep -i "^$header:" | head -1 | sed "s/^[^:]*: *//")"
  if [[ $got =~ $regex ]]; then
    pass "$label ($header: $got)"
  else
    fail "$label" "$path: $header was '${got:-<absent>}', expected to match /$regex/"
  fi
}

echo
echo "== pages resolve =="
expect_status 'root' / 200
expect_status 'root keeps a shared link query string' '/?price=25000&goal=vehicle' 200
expect_status 'sources page' /sources/ 200
expect_status 'salary methodology' /methodology/salary/ 200
expect_status 'vehicle methodology' /methodology/vehicle/ 200
expect_status 'favicon' /favicon.svg 200
expect_status 'hashed asset' "$ASSET" 200
expect_status 'HEAD on root (the Docker HEALTHCHECK probe)' / 200 --head

echo
echo "== directory without a trailing slash =="
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sources")"
case $code in
200) pass "/sources served directly (200)" ;;
301 | 302)
  loc="$(curl -sS -D - -o /dev/null "$BASE/sources" |
    tr -d '\r' | grep -i '^location:' | head -1 | sed 's/^[^:]*: *//')"
  if [[ $loc == */sources/ ]]; then
    pass "/sources redirects to $loc"
  else
    fail '/sources redirect target' "redirected to '$loc', expected it to end in /sources/"
  fi
  ;;
*) fail '/sources' "expected 200 or a redirect to /sources/, got $code" ;;
esac
expect_status 'following the redirect lands on the page' /sources 200 -L

echo
echo "== unknown paths 404 instead of serving the SPA =="
expect_status 'unknown path' /does-not-exist 404
expect_status 'unknown script' /nope.js 404
expect_status 'typo under a real directory' /sources/typo 404
expect_status 'missing hashed asset' /assets/does-not-exist.js 404

echo
echo "== cache headers =="
expect_header 'root HTML is not cached' / Cache-Control 'no-cache'
expect_header 'sources HTML is not cached' /sources/ Cache-Control 'no-cache'
expect_header 'hashed asset is immutable for a year' "$ASSET" Cache-Control 'max-age=31536000.*immutable'

echo
echo "== compression =="
expect_header 'asset is gzipped when offered' "$ASSET" Content-Encoding '^gzip$' -H 'Accept-Encoding: gzip'
expect_header 'HTML is gzipped when offered' / Content-Encoding '^gzip$' -H 'Accept-Encoding: gzip'
expect_header 'asset advertises Vary' "$ASSET" Vary 'Accept-Encoding' -H 'Accept-Encoding: gzip'
if curl -sS -D - -o /dev/null "$BASE$ASSET" | tr -d '\r' | grep -qi '^content-encoding:'; then
  fail 'asset is served plain without Accept-Encoding' 'got a Content-Encoding anyway'
else
  pass 'asset is served plain when gzip is not offered'
fi

echo
echo "== security headers =="
for path in / /sources/ "$ASSET"; do
  expect_header "nosniff on $path" "$path" X-Content-Type-Options '^nosniff$'
  expect_header "Referrer-Policy on $path" "$path" Referrer-Policy 'strict-origin-when-cross-origin'
  expect_header "X-Frame-Options on $path" "$path" X-Frame-Options '^DENY$'
  expect_header "frame-ancestors on $path" "$path" Content-Security-Policy "frame-ancestors 'none'"
done
expect_header 'security headers survive a 404' /does-not-exist X-Content-Type-Options '^nosniff$'

echo
if [[ $FAILED -eq 0 ]]; then
  echo "All nginx.conf checks passed."
else
  echo "Some nginx.conf checks failed (see above)." >&2
fi
exit $FAILED

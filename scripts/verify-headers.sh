#!/usr/bin/env bash
#
# Asserts the HTTP behaviour the site is supposed to have, against any base
# URL: compression, cache headers, security headers, and a real 404 for
# unknown paths instead of an SPA fallback.
#
# It knows nothing about how the site is being served. scripts/verify-nginx.sh
# boots the repository's own nginx.conf against ./dist and points this script
# at it, and the same script can be pointed at a staging or production
# deployment after a deploy — so one list of expectations covers both, and a
# CDN's header policy can't quietly drift away from nginx.conf.
#
# Everything is discovered from the URL: the hashed asset paths come out of the
# served HTML, so no build directory is needed.
#
# Usage: scripts/verify-headers.sh <base-url>
#   e.g. scripts/verify-headers.sh http://127.0.0.1:8089
#        scripts/verify-headers.sh https://staging.example.com

set -euo pipefail

usage() {
  echo "Usage: $(basename "${BASH_SOURCE[0]}") <base-url>" >&2
  echo "  e.g. $(basename "${BASH_SOURCE[0]}") http://127.0.0.1:8089" >&2
}

if [[ $# -lt 1 || -z ${1:-} ]]; then
  echo "No base URL given." >&2
  usage
  exit 2
fi
if [[ $# -gt 1 ]]; then
  echo "Expected one base URL, got $#: $*" >&2
  usage
  exit 2
fi

# Trailing slashes are stripped so that "$BASE$path" can never produce a `//`
# path, which some servers treat as a different URL from the one meant.
BASE="$1"
while [[ $BASE == */ ]]; do BASE="${BASE%/}"; done

case $BASE in
http://* | https://*) ;;
*)
  echo "Base URL must start with http:// or https:// — got '$1'" >&2
  usage
  exit 2
  ;;
esac

# A site that isn't answering at all would otherwise report every assertion
# below as a separate failure; say so once instead, with curl's own reason.
if ! reach_err="$(curl -sS -o /dev/null --max-time 20 "$BASE/" 2>&1)"; then
  echo "Could not reach $BASE/ — ${reach_err:-no response}" >&2
  exit 1
fi

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
    fail "$label" "$BASE$path: status expected $want, got $got"
  fi
}

# Asserts a response header is absent.
expect_no_header() {
  local label=$1 path=$2 header=$3
  local got
  # `|| true`: an absent header is the passing case here, and grep's exit 1
  # for "no match" would otherwise end the script under `set -e -o pipefail`.
  got="$(curl -sS -D - -o /dev/null "$BASE$path" |
    tr -d '\r' | { grep -i "^$header:" || true; } | head -1 | sed "s/^[^:]*: *//")"
  if [[ -z $got ]]; then
    pass "$label (no $header)"
  else
    fail "$label" "$BASE$path: $header expected to be absent, got '$got'"
  fi
}

# Asserts a response header matches a regex.
expect_header() {
  local label=$1 path=$2 header=$3 regex=$4
  shift 4
  local got
  got="$(curl -sS -D - -o /dev/null "$@" "$BASE$path" |
    tr -d '\r' | { grep -i "^$header:" || true; } | head -1 | sed "s/^[^:]*: *//")"
  if [[ $got =~ $regex ]]; then
    pass "$label ($header: $got)"
  else
    fail "$label" "$BASE$path: $header was '${got:-<absent>}', expected to match /$regex/"
  fi
}

# The hashed assets, read out of the served HTML rather than a build
# directory, so this works against a deployment we have no local copy of.
HOME_HTML="$(curl -sS "$BASE/")"
first_asset() {
  grep -o "/assets/[A-Za-z0-9._-]*\\.$1" <<<"$HOME_HTML" | sort | head -1
}
ASSET_JS="$(first_asset js)"
ASSET_CSS="$(first_asset css)"
if [[ -z $ASSET_JS ]]; then
  echo "No /assets/*.js reference found in $BASE/ — is this the built site?" >&2
  exit 1
fi

echo "Checking $BASE"

echo
echo "== pages resolve =="
expect_status 'root' / 200
expect_status 'root keeps a shared link query string' '/?price=25000&goal=vehicle' 200
expect_status 'sources page' /sources/ 200
expect_status 'salary methodology' /methodology/salary/ 200
expect_status 'vehicle methodology' /methodology/vehicle/ 200
expect_status 'favicon' /favicon.svg 200
expect_status 'hashed asset' "$ASSET_JS" 200
expect_status 'HEAD on root (the Docker HEALTHCHECK probe)' / 200 --head

echo
echo "== directory without a trailing slash =="
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sources")"
case $code in
200) pass "/sources served directly (200)" ;;
301 | 302 | 308)
  loc="$(curl -sS -D - -o /dev/null "$BASE/sources" |
    tr -d '\r' | { grep -i '^location:' || true; } | head -1 | sed 's/^[^:]*: *//')"
  if [[ $loc == */sources/ ]]; then
    pass "/sources redirects to $loc"
  else
    fail '/sources redirect target' "$BASE/sources: Location was '${loc:-<absent>}', expected it to end in /sources/"
  fi
  ;;
*) fail '/sources' "$BASE/sources: status expected 200 or a redirect to /sources/, got $code" ;;
esac
expect_status 'following the redirect lands on the page' /sources 200 -L

echo
echo "== unknown paths 404 instead of serving the SPA =="
expect_status 'unknown path' /does-not-exist 404
expect_status 'unknown script' /nope.js 404
expect_status 'typo under a real directory' /sources/typo 404
expect_status 'missing hashed asset' /assets/does-not-exist.js 404
# A 404 must never be cached: under /assets/ it would be pinned as immutable
# for a year, and elsewhere it would hide a page published later.
expect_no_header 'a missing hashed asset is not cached' /assets/does-not-exist.js Cache-Control
expect_no_header 'an unknown path is not cached' /does-not-exist Cache-Control

echo
echo "== cache headers =="
expect_header 'root HTML is not cached' / Cache-Control 'no-cache'
expect_header 'sources HTML is not cached' /sources/ Cache-Control 'no-cache'
expect_header 'hashed asset is immutable for a year' "$ASSET_JS" Cache-Control 'max-age=31536000.*immutable'
# Unhashed public files: cacheable, but only for an hour, so replacing one
# reaches visitors the same day rather than after a year.
for path in /favicon.svg /og-image.png /robots.txt /sitemap.xml; do
  expect_header "$path is cached for an hour" "$path" Cache-Control 'max-age=3600'
done

echo
echo "== compression =="
# Either encoding is acceptable: nginx here offers gzip, while a CDN in front
# of the same files may prefer Brotli.
expect_header 'JS is compressed when offered' "$ASSET_JS" Content-Encoding '^(br|gzip)$' -H 'Accept-Encoding: br, gzip'
expect_header 'HTML is compressed when offered' / Content-Encoding '^(br|gzip)$' -H 'Accept-Encoding: br, gzip'
expect_header 'JS advertises Vary' "$ASSET_JS" Vary 'Accept-Encoding' -H 'Accept-Encoding: br, gzip'
if [[ -n $ASSET_CSS ]]; then
  expect_header 'CSS is compressed when offered' "$ASSET_CSS" Content-Encoding '^(br|gzip)$' -H 'Accept-Encoding: br, gzip'
else
  echo "  --   no /assets/*.css referenced from $BASE/; skipping the CSS compression check"
fi
if curl -sS -D - -o /dev/null "$BASE$ASSET_JS" | tr -d '\r' | grep -qi '^content-encoding:'; then
  fail 'asset is served plain without Accept-Encoding' "$BASE$ASSET_JS: got a Content-Encoding anyway"
else
  pass 'asset is served plain when compression is not offered'
fi

echo
echo "== security headers =="
for path in / /sources/ "$ASSET_JS"; do
  expect_header "nosniff on $path" "$path" X-Content-Type-Options '^nosniff$'
  expect_header "Referrer-Policy on $path" "$path" Referrer-Policy 'strict-origin-when-cross-origin'
  expect_header "X-Frame-Options on $path" "$path" X-Frame-Options '^DENY$'
  expect_header "frame-ancestors on $path" "$path" Content-Security-Policy "frame-ancestors 'none'"
done
# The headers carry `always` in nginx.conf precisely so an error response keeps
# them; a 404 is the one error response we can ask for on demand.
expect_header 'security headers survive a 404' /does-not-exist X-Content-Type-Options '^nosniff$'
expect_header 'Referrer-Policy survives a 404' /does-not-exist Referrer-Policy 'strict-origin-when-cross-origin'
expect_header 'X-Frame-Options survives a 404' /does-not-exist X-Frame-Options '^DENY$'
expect_header 'frame-ancestors survives a 404' /does-not-exist Content-Security-Policy "frame-ancestors 'none'"

# HSTS only makes sense on https, and nginx.conf deliberately doesn't set it:
# TLS is terminated in front of the container, so the edge owns this header.
if [[ $BASE == https://* ]]; then
  echo
  echo "== HSTS (https only) =="
  expect_header 'HSTS is set for at least a year' / Strict-Transport-Security 'max-age=(3153[6-9][0-9]{3}|[4-9][0-9]{7}|[1-9][0-9]{8,})'
fi

echo
if [[ $FAILED -eq 0 ]]; then
  echo "All header checks passed against $BASE."
else
  echo "Some header checks failed against $BASE (see above)." >&2
fi
exit $FAILED

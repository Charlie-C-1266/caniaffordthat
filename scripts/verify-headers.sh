#!/usr/bin/env bash
#
# Asserts the HTTP behaviour the site is supposed to have, against any base
# URL: compression, cache headers, security headers, and a real 404 for
# unknown paths instead of an SPA fallback — served with the branded
# public/404.html body rather than a server's default error page.
#
# scripts/verify-nginx.sh boots the repository's own nginx.conf against ./dist
# and points this script at it, and the same script can be pointed at a
# staging or production deployment after a deploy — so one list of
# expectations covers both, and a CDN's header policy can't quietly drift away
# from nginx.conf.
#
# The list is nginx's, and every host is held to it except Vercel, which is
# recognised by the `x-vercel-id` header it puts on every response. Vercel
# differs from nginx in a few ways no configuration can change, and each check
# that branches on it says why: the four checks that cannot hold there are
# reported as skipped rather than failed, and an extensionless unknown path is
# followed through Vercel's one trailing-slash redirect before its 404 is
# checked. A host that doesn't send the header gets the full nginx list, so
# losing it fails safe.
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

# Read into a variable before matching: `curl | grep -q` lets grep exit at the
# first match, and curl's resulting write error would then fail the whole
# pipeline under `pipefail`, so a Vercel response could be taken for nginx's.
home_headers="$(curl -sS -D - -o /dev/null --max-time 20 "$BASE/" | tr -d '\r')"
SERVED_BY=nginx
if grep -qi '^x-vercel-id:' <<<"$home_headers"; then
  SERVED_BY=vercel
fi

FAILED=0
SKIPPED=0
pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() {
  printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2" >&2
  FAILED=1
}
skip() {
  printf '  --   %s (skipped: %s)\n' "$1" "$2"
  SKIPPED=$((SKIPPED + 1))
}

# Runs the assertion that follows the reason only against nginx. On Vercel it
# is reported as skipped, with the reason it cannot hold there, so a pass is
# never mistaken for having checked it.
nginx_only() {
  local reason=$1
  shift
  if [[ $SERVED_BY == nginx ]]; then
    "$@"
  else
    skip "$2" "$reason"
  fi
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

# Prints a response header's value for a path, or nothing when it's absent,
# with optional extra curl args after the header name. `|| true`: an absent
# header is a normal answer, and grep's exit 1 for "no match" would otherwise
# end the script under `set -e -o pipefail`.
header_of() {
  local path=$1 header=$2
  shift 2
  curl -sS -D - -o /dev/null "$@" "$BASE$path" |
    tr -d '\r' | { grep -i "^$header:" || true; } | head -1 | sed 's/^[^:]*: *//'
}

# Asserts a response header is absent.
# Only ever called through nginx_only, which shellcheck can't see through.
# shellcheck disable=SC2317
expect_no_header() {
  local label=$1 path=$2 header=$3
  local got
  got="$(header_of "$path" "$header")"
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
  got="$(header_of "$path" "$header" "$@")"
  if [[ $got =~ $regex ]]; then
    pass "$label ($header: $got)"
  else
    fail "$label" "$BASE$path: $header was '${got:-<absent>}', expected to match /$regex/"
  fi
}

# Asserts the response body for a path contains a fixed string.
expect_body() {
  local label=$1 path=$2 needle=$3
  if curl -sS "$BASE$path" | grep -qF -- "$needle"; then
    pass "$label ($path contains '$needle')"
  else
    fail "$label" "$BASE$path: body did not contain '$needle'"
  fi
}

# Asserts that a path permanently redirects to the same path with a trailing
# slash on the same site, which is what Vercel's `trailingSlash: true` does.
# Only a permanent status passes: a 302 would tell a crawler to keep the
# unslashed URL. The Location may be relative or absolute.
expect_slash_redirect() {
  local label=$1 path=$2
  local code loc
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")"
  loc="$(header_of "$path" Location)"
  if [[ $code != 301 && $code != 308 ]]; then
    fail "$label" "$BASE$path: status expected a 301 or 308 to $path/, got $code"
  elif [[ $loc != "$path/" && $loc != "$BASE$path/" ]]; then
    fail "$label" "$BASE$path: Location was '${loc:-<absent>}', expected $path/"
  else
    pass "$label ($path -> $code to $loc)"
  fi
}

# A string that appears only in public/404.html, so a server's plain error
# body (or the calculator served by mistake) fails the body assertions below.
NOT_FOUND_MARKER="This page doesn't exist"

# The hashed assets, read out of the served HTML rather than a build
# directory, so this works against a deployment we have no local copy of.
HOME_HTML="$(curl -sS "$BASE/")"
# `|| true`: no match is a case handled below with its own message, and grep's
# exit 1 would otherwise end the script silently under `set -e -o pipefail`.
first_asset() {
  { grep -o "/assets/[A-Za-z0-9._-]*\\.$1" <<<"$HOME_HTML" || true; } | sort | head -1
}
ASSET_JS="$(first_asset js)"
ASSET_CSS="$(first_asset css)"
if [[ -z $ASSET_JS ]]; then
  echo "No /assets/*.js reference found in $BASE/ — is this the built site?" >&2
  exit 1
fi

if [[ $SERVED_BY == vercel ]]; then
  echo "Checking $BASE (Vercel, recognised by x-vercel-id: nginx-only checks are skipped)"
else
  echo "Checking $BASE"
fi

echo
echo "== pages resolve =="
expect_status 'root' / 200
expect_status 'root keeps a shared link query string' '/?price=25000&goal=vehicle' 200
expect_status 'sources page' /sources/ 200
expect_status 'salary methodology' /methodology/salary/ 200
expect_status 'vehicle methodology' /methodology/vehicle/ 200
expect_status 'favicon' /favicon.svg 200
expect_status 'robots.txt' /robots.txt 200
expect_status 'sitemap.xml' /sitemap.xml 200
expect_status 'OG image' /og-image.png 200
expect_status 'hashed asset' "$ASSET_JS" 200
expect_status 'HEAD on root (the Docker HEALTHCHECK probe)' / 200 --head

echo
echo "== directory without a trailing slash =="
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sources")"
case $code in
200) pass "/sources served directly (200)" ;;
301 | 302 | 308)
  loc="$(header_of /sources Location)"
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
# The two extensionless unknown paths the 404 checks below are run against.
# nginx answers each with a 404 directly. Vercel's `trailingSlash: true` first
# redirects each to its slashed form, the same redirect that takes /sources to
# /sources/, and only that URL is the 404. So on Vercel that one hop is
# checked here and every 404 check below runs against the URL it leads to.
# Nothing else is followed: a redirect anywhere else, or a second hop from the
# slashed URL, still fails the checks below.
MISSING_PAGE=/does-not-exist
MISSING_TYPO=/sources/typo
if [[ $SERVED_BY == vercel ]]; then
  expect_slash_redirect 'unknown path redirects to its slashed form' "$MISSING_PAGE"
  expect_slash_redirect 'typo under a real directory redirects to its slashed form' "$MISSING_TYPO"
  MISSING_PAGE+=/
  MISSING_TYPO+=/
fi
expect_status 'unknown path' "$MISSING_PAGE" 404
expect_status 'unknown script' /nope.js 404
expect_status 'typo under a real directory' "$MISSING_TYPO" 404
expect_status 'missing hashed asset' /assets/does-not-exist.js 404
# A 404 must never be cached: under /assets/ it would be pinned as immutable
# for a year, and elsewhere it would hide a page published later. nginx
# manages that by leaving `always` off its Cache-Control headers. Vercel can't
# match a header on status, only on path, so its 404s carry their path's rule.
NO_CACHE_404_REASON="Vercel matches headers by path, not status, so a 404 carries its path's Cache-Control"
nginx_only "$NO_CACHE_404_REASON" \
  expect_no_header 'a missing hashed asset is not cached' /assets/does-not-exist.js Cache-Control
nginx_only "$NO_CACHE_404_REASON" \
  expect_no_header 'an unknown path is not cached' "$MISSING_PAGE" Cache-Control

echo
echo "== the branded 404 body =="
# The status must stay 404 alongside the branded body: a 200 here would tell a
# crawler the mistyped URL is a real page.
for path in "$MISSING_PAGE" /nope.js "$MISSING_TYPO"; do
  expect_status "status stays 404 on $path" "$path" 404
  expect_body "branded body on $path" "$path" "$NOT_FOUND_MARKER"
  expect_body "a way back on $path" "$path" 'href="/"'
done
expect_header 'the 404 body is HTML' "$MISSING_PAGE" Content-Type '^text/html'
# nginx's own plain error body is what the branded page replaces, so its
# tell-tale must be gone — otherwise a broken `error_page` would pass the
# checks above on a page that still says "404 Not Found" in Times New Roman.
if curl -sS "$BASE$MISSING_PAGE" | grep -qF '<center>'; then
  fail "the 404 body is the branded page" "$BASE$MISSING_PAGE: still a server's default error page"
else
  pass "the 404 body is not a server's default error page"
fi
# A directory that exists but holds no index.html of its own. /methodology/
# holds only salary/ and vehicle/, so nginx's `index` finds nothing and,
# autoindex being off, it answers 403 rather than 404 unless `error_page 403
# =404` rewrites it. It is a natural URL to reach by trimming
# /methodology/salary/ back, and the Vercel deployment already answers it with
# a 404 — so this belongs in the shared list, where it holds both servers to
# the same answer.
expect_status 'a directory without an index is a 404, not a 403' /methodology/ 404
expect_body 'the branded body on a directory without an index' /methodology/ "$NOT_FOUND_MARKER"
nginx_only "$NO_CACHE_404_REASON" \
  expect_no_header 'a directory 404 is not cached' /methodology/ Cache-Control
# Without the trailing slash the server redirects to the slashed form, which
# must end on the branded 404 too — so there is no 403 on either spelling.
expect_status 'the same directory without a trailing slash ends on the 404 too' /methodology 404 -L
# No path should answer 403 at all: "forbidden" is the wrong answer for a URL
# that simply has no page, and it is the one status that would reach a visitor
# as a bare server error rather than the branded body.
for path in /methodology/ /methodology /does-not-exist /assets/does-not-exist.js /sources/typo; do
  got="$(curl -s -L -o /dev/null -w '%{http_code}' "$BASE$path")"
  if [[ $got == 403 ]]; then
    fail 'no bare 403 anywhere' "$BASE$path: returned 403"
  else
    pass "no 403 on $path (got $got)"
  fi
done

# /404.html must not become a 200 duplicate of the real pages. nginx makes it
# `internal`, so a direct request is itself a 404; a host that serves static
# files by path (Vercel, or S3 behind CloudFront) answers 200, and there the
# page's own `noindex` is what keeps it out of search results. Either is fine.
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/404.html")"
if [[ $code == 404 ]]; then
  pass "a direct request for /404.html is itself a 404"
elif [[ $code == 200 ]] && curl -sS "$BASE/404.html" | grep -qF '<meta name="robots" content="noindex"'; then
  pass "a direct request for /404.html is a 200 marked noindex"
else
  fail '/404.html requested directly' "$BASE/404.html: expected a 404, or a 200 carrying noindex; got $code"
fi

echo
echo "== cache headers =="
expect_header 'root HTML is not cached' / Cache-Control 'no-cache'
expect_header 'sources HTML is not cached' /sources/ Cache-Control 'no-cache'
expect_header 'hashed asset is immutable for a year' "$ASSET_JS" Cache-Control 'max-age=31536000.*immutable'
# Unhashed public files: cacheable, but only for an hour, so replacing one
# reaches visitors the same day rather than after a year.
for path in /favicon.svg /og-image.png /robots.txt /sitemap.xml; do
  # Anchored: an unanchored 'max-age=3600' also matches max-age=36000, which
  # is ten hours, and would have passed silently.
  expect_header "$path is cached for an hour" "$path" Cache-Control '^public, max-age=3600$'
done

echo
echo "== the crawler-facing files =="
# Served with the right type, and with their own content rather than the SPA
# fallback: a host that answers an unknown path with index.html and a 200
# satisfies the status checks above while serving a crawler a web page where
# it asked for a sitemap.
expect_header 'robots.txt is plain text' /robots.txt Content-Type '^text/plain'
expect_header 'sitemap.xml is XML' /sitemap.xml Content-Type '^(application|text)/xml'
expect_header 'the OG image is a PNG' /og-image.png Content-Type '^image/png'
expect_body 'robots.txt names the sitemap' /robots.txt 'Sitemap:'
expect_body 'sitemap.xml is a sitemap, not an HTML page' /sitemap.xml '<urlset'
# The OG image is binary, so its body is checked by shape rather than content:
# a PNG starts with the eight-byte signature, which an HTML fallback does not.
# Downloaded to a file rather than piped into `head`: closing the pipe after
# eight bytes makes curl fail with a write error, which `pipefail` then turns
# into a failure of this check rather than of the thing it is testing.
png_body="$(mktemp)"
if curl -sS -o "$png_body" "$BASE/og-image.png" &&
  [[ "$(head -c 8 "$png_body" | od -An -tx1 | tr -d ' \n')" == 89504e470d0a1a0a ]]; then
  pass 'the OG image really is a PNG (file signature)'
else
  fail 'the OG image really is a PNG' "$BASE/og-image.png: body does not start with the PNG signature"
fi
rm -f "$png_body"

echo
echo "== compression =="
# Either encoding is acceptable: nginx here offers gzip, while a CDN in front
# of the same files may prefer Brotli.
expect_header 'JS is compressed when offered' "$ASSET_JS" Content-Encoding '^(br|gzip)$' -H 'Accept-Encoding: br, gzip'
expect_header 'HTML is compressed when offered' / Content-Encoding '^(br|gzip)$' -H 'Accept-Encoding: br, gzip'
# Vary tells a shared cache between the server and the visitor to keep the
# compressed and plain copies apart. Vercel sends none: its CDN negotiates the
# encoding itself, so over HTTPS only a cache past that edge could mix them up.
nginx_only "Vercel's CDN negotiates the encoding itself and sends no Vary" \
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
for path in / /sources/ "$ASSET_JS" /robots.txt /sitemap.xml /og-image.png; do
  expect_header "nosniff on $path" "$path" X-Content-Type-Options '^nosniff$'
  expect_header "Referrer-Policy on $path" "$path" Referrer-Policy 'strict-origin-when-cross-origin'
  expect_header "X-Frame-Options on $path" "$path" X-Frame-Options '^DENY$'
  expect_header "frame-ancestors on $path" "$path" Content-Security-Policy "frame-ancestors 'none'"
done
# The headers carry `always` in nginx.conf precisely so an error response keeps
# them; a 404 is the one error response we can ask for on demand. On Vercel
# this is the slashed URL's 404: the redirect in front of it is Vercel's own
# and carries none of the headers, which costs nothing, as a redirect has no
# body to frame or sniff.
expect_header 'security headers survive a 404' "$MISSING_PAGE" X-Content-Type-Options '^nosniff$'
expect_header 'Referrer-Policy survives a 404' "$MISSING_PAGE" Referrer-Policy 'strict-origin-when-cross-origin'
expect_header 'X-Frame-Options survives a 404' "$MISSING_PAGE" X-Frame-Options '^DENY$'
expect_header 'frame-ancestors survives a 404' "$MISSING_PAGE" Content-Security-Policy "frame-ancestors 'none'"
# The directory case reaches the 404 body through a different route (a
# rewritten 403, not a `try_files` miss), so its headers are asserted too
# rather than assumed to follow.
expect_header 'nosniff on the directory 404' /methodology/ X-Content-Type-Options '^nosniff$'
expect_header 'Referrer-Policy on the directory 404' /methodology/ Referrer-Policy 'strict-origin-when-cross-origin'
expect_header 'X-Frame-Options on the directory 404' /methodology/ X-Frame-Options '^DENY$'
expect_header 'frame-ancestors on the directory 404' /methodology/ Content-Security-Policy "frame-ancestors 'none'"

# HSTS only makes sense on https, and nginx.conf deliberately doesn't set it:
# TLS is terminated in front of the container, so the edge owns this header.
if [[ $BASE == https://* ]]; then
  echo
  echo "== HSTS (https only) =="
  # Compared as a number, not matched as a pattern: a regex for "at least
  # 31536000" is easy to get subtly wrong at the digit boundaries.
  hsts="$(header_of / Strict-Transport-Security)"
  if [[ $hsts =~ max-age=([0-9]+) ]] && ((10#${BASH_REMATCH[1]} >= 31536000)); then
    pass "HSTS is set for at least a year (Strict-Transport-Security: $hsts)"
  else
    fail 'HSTS is set for at least a year' "$BASE/: Strict-Transport-Security was '${hsts:-<absent>}', expected max-age of at least 31536000"
  fi
fi

echo
if [[ $FAILED -eq 0 && $SKIPPED -gt 0 ]]; then
  echo "All header checks passed against $BASE, with $SKIPPED nginx-only checks skipped."
elif [[ $FAILED -eq 0 ]]; then
  echo "All header checks passed against $BASE."
else
  echo "Some header checks failed against $BASE (see above)." >&2
fi
exit $FAILED

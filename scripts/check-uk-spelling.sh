#!/usr/bin/env bash
#
# Fails when the lines a branch adds use US spellings ("color", "behavior",
# "organize", "toward" …). The site is UK-only, and that covers comments, test
# names and docs as well as copy, so this takes the mechanical part of that
# check out of PR review.
#
# Only added lines are read (`git diff <base>...HEAD`), so text that is already
# on the base branch never blocks a PR; a line that a PR touches is checked
# afresh.
#
# What is deliberately not flagged:
#   - names rather than prose: camelCase, PascalCase, snake_case and SHOUTING
#     identifiers (`backgroundColor`, `ScrollBehavior`, `LabeledMoneyField`,
#     `saveFlavor`), member access (`.normalize`) and calls (`normalize(`);
#   - anything inside a URL;
#   - spellings fixed by a spec, such as CSS `color:` and `text-align: center`
#     or `scrollTo({ behavior: 'smooth' })`. Those are listed as patterns in
#     scripts/uk-spelling-allow.txt; add to that file rather than to the logic
#     here when a new one turns up.
# Words are matched whole, so `literal` is never read as `liter`.
#
# Usage: scripts/check-uk-spelling.sh [base-ref]    (default: origin/dev)
#   e.g. scripts/check-uk-spelling.sh
#        scripts/check-uk-spelling.sh origin/main
#
# Exit status: 0 if the added lines are clean, 1 if any US spelling was found
# (each one is printed as file:line), 2 on a usage or git error. Under GitHub
# Actions each finding is also an error annotation on the PR's diff.

set -euo pipefail

usage() {
  echo "Usage: $(basename "${BASH_SOURCE[0]}") [base-ref]   (default: origin/dev)" >&2
}

if [[ $# -gt 1 ]]; then
  echo "Expected at most one base ref, got $#: $*" >&2
  usage
  exit 2
fi

base=${1:-origin/dev}
allowlist="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/uk-spelling-allow.txt"

if [[ ! -r $allowlist ]]; then
  echo "Allowlist not found: $allowlist" >&2
  exit 2
fi
# The pathspecs below are relative to the repository root, wherever this is
# run from.
cd "$(git rev-parse --show-toplevel)"
if ! git rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
  echo "Unknown base ref '$base'. Fetch it first, e.g. git fetch origin dev" >&2
  exit 2
fi
if ! git merge-base "$base" HEAD >/dev/null; then
  echo "No merge base between '$base' and HEAD. A shallow clone needs the" >&2
  echo "full history for this (actions/checkout: fetch-depth: 0)." >&2
  exit 2
fi

# This script and its allowlist have to spell the US words out, and the
# lockfile isn't ours to edit.
if ! diff=$(git -c core.quotePath=false diff --no-color --no-ext-diff \
  --unified=0 "$base...HEAD" -- . \
  ':(exclude)scripts/check-uk-spelling.sh' \
  ':(exclude)scripts/uk-spelling-allow.txt' \
  ':(exclude)package-lock.json'); then
  exit 2
fi

# POSIX awk only (no gawk extensions), so the same check runs in CI and on a
# contributor's macOS or Linux machine.
awk -v allowlist="$allowlist" -v base="$base" -v gha="${GITHUB_ACTIONS:-}" '
BEGIN {
  # US spelling = UK spelling. Each is matched as a whole word, case-blind on
  # its first letter only.
  n = split( \
    "color=colour colors=colours colored=coloured coloring=colouring " \
    "colorful=colourful " \
    "behavior=behaviour behaviors=behaviours behavioral=behavioural " \
    "center=centre centers=centres centered=centred centering=centring " \
    "favor=favour favors=favours favored=favoured favoring=favouring " \
    "favorite=favourite favorites=favourites favorable=favourable " \
    "flavor=flavour flavors=flavours " \
    "honor=honour honors=honours honored=honoured honoring=honouring " \
    "honorable=honourable " \
    "labor=labour labors=labours labored=laboured " \
    "neighbor=neighbour neighbors=neighbours neighboring=neighbouring " \
    "neighborhood=neighbourhood " \
    "catalog=catalogue catalogs=catalogues " \
    "gray=grey grays=greys " \
    "defense=defence defenses=defences " \
    "canceled=cancelled canceling=cancelling " \
    "modeled=modelled modeling=modelling " \
    "labeled=labelled labeling=labelling " \
    "traveled=travelled traveling=travelling traveler=traveller " \
    "travelers=travellers " \
    "fulfill=fulfil fulfills=fulfils fulfillment=fulfilment " \
    "meter=metre meters=metres liter=litre liters=litres " \
    "fiber=fibre fibers=fibres theater=theatre theaters=theatres " \
    "toward=towards tire=tyre tires=tyres aluminum=aluminium " \
    "mold=mould molds=moulds molded=moulded molding=moulding moldy=mouldy " \
    "plow=plough plows=ploughs plowed=ploughed", pairs, " ")
  for (i = 1; i <= n; i++) {
    split(pairs[i], kv, "=")
    uk[kv[1]] = kv[2]
  }

  # -ize/-yze stems, matched anywhere in a word: "reorganized",
  # "deserialize" and "analyzer" are all caught. The UK form swaps the final
  # z of the stem for an s.
  stems = "(organiz|recogniz|realiz|optimiz|normaliz|initializ|minimiz" \
    "|maximiz|prioritiz|summariz|customiz|analyz|categoriz|amortiz|stabiliz" \
    "|serializ|synchroniz|standardiz|visualiz|utiliz|emphasiz|memoiz)"

  nallow = 0
  while ((read = (getline pat < allowlist)) > 0) {
    sub(/^[ \t]+/, "", pat)
    sub(/[ \t]+$/, "", pat)
    if (pat == "" || substr(pat, 1, 1) == "#") continue
    # A pattern that matches nothing at all would be blanked out between
    # every character, splitting every word and silently passing every line.
    if ("" ~ pat) {
      print "Allowlist pattern matches empty text: " pat > "/dev/stderr"
      bad = 2
      exit 2
    }
    allow[++nallow] = pat
  }
  if (read < 0) {
    print "Could not read the allowlist: " allowlist > "/dev/stderr"
    bad = 2
    exit 2
  }
  close(allowlist)
}

# Unified-diff bookkeeping. A "+++ " line is only a file header between
# "diff --git" and the first hunk; inside a hunk it is an added line that
# happens to start with "++ ".
/^diff --git / { header = 1; next }
header && /^\+\+\+ / {
  file = substr($0, 5)
  if (file != "/dev/null") file = substr(file, 3)   # drop the "b/"
  next
}
/^@@ / {
  header = 0
  # "@@ -12,3 +40,2 @@": the added lines start at line 40 of the new file.
  match($0, /\+[0-9]+/)
  lineno = substr($0, RSTART + 1, RLENGTH - 1) + 0
  next
}
header { next }
/^\+/ { check(substr($0, 2)); lineno++ }

function check(text,    line, i, tok, before, after, key, fix) {
  line = text
  # Words in a URL are spelled however the site spells them.
  gsub(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^] \t"\047`<>()[]*/, " ", line)
  for (i = 1; i <= nallow; i++) gsub(allow[i], " ", line)

  while (match(line, /[A-Za-z0-9_$]+/)) {
    tok = substr(line, RSTART, RLENGTH)
    before = RSTART > 1 ? substr(line, RSTART - 1, 1) : ""
    after = substr(line, RSTART + RLENGTH, 2)
    line = substr(line, RSTART + RLENGTH)

    # Prose words only: all lower case, or capitalised at the start of a
    # sentence. Anything else is a name.
    if (tok !~ /^[A-Za-z][a-z]*$/) continue
    # Member access and calls are code, not prose: `s.normalize`,
    # `colors.background`, `normalize(`. A full stop that ends a sentence is
    # followed by a space or the end of the line, so it still counts.
    if (before == "." || after ~ /^(\(|\.[A-Za-z_$])/) continue

    key = tolower(substr(tok, 1, 1)) substr(tok, 2)
    if (key in uk) {
      fix = uk[key]
    } else if (match(key, stems)) {
      fix = substr(key, 1, RSTART + RLENGTH - 2) "s" substr(key, RSTART + RLENGTH)
    } else {
      continue
    }
    if (tok != key) fix = toupper(substr(fix, 1, 1)) substr(fix, 2)
    report(tok, fix)
  }
}

function report(word, fix,    msg) {
  found++
  msg = file ":" lineno ": \"" word "\" is a US spelling; UK: \"" fix "\""
  if (gha == "true") {
    printf "::error file=%s,line=%d,title=US spelling::%s\n", file, lineno, msg
  } else {
    print msg
  }
}

END {
  if (bad) exit bad
  if (found) {
    print ""
    printf "%d US spelling%s in lines added since %s.\n", found, \
      found == 1 ? "" : "s", base
    print "Use the UK spelling. If the word is fixed by a spec or an API (a CSS"
    print "property, a DOM option), add a pattern for it to"
    print "scripts/uk-spelling-allow.txt instead."
    exit 1
  }
}
' <<<"$diff"

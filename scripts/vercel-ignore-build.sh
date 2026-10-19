#!/usr/bin/env bash
#
# Vercel's "Ignored Build Step", wired up through `ignoreCommand` in
# vercel.json. Vercel runs it on each Git deployment before building: exit 0
# cancels the build (the deployment's state becomes `CANCELED`), and any other
# exit code lets it run.
#
# It skips a preview build only when nothing that reaches the deployed site has
# changed since the branch's last successful deployment. A push that only
# touches tests, e2e specs, docs or CI config then gives the Hobby plan's single
# build slot back within seconds instead of holding it for a full build. GitHub
# Actions still builds and tests every PR, so a skipped preview leaves nothing
# unchecked.
#
# Anything short of a confident skip builds:
#   - production deployments, so `main` always deploys;
#   - a branch's first deployment, which has no previous SHA to compare with;
#   - a previous SHA that's missing from Vercel's shallow clone and can't be
#     fetched;
#   - any changed path that isn't on the non-app list below, including paths
#     the list has never heard of;
#   - any error at all.
#
# A dry run against two real commits (exit 0 = would skip, 1 = would build):
#   VERCEL_ENV=preview VERCEL_GIT_PREVIOUS_SHA=<older> \
#     VERCEL_GIT_COMMIT_SHA=<newer> scripts/vercel-ignore-build.sh

set -Eeuo pipefail

build() {
  echo "vercel-ignore-build: building. $1"
  exit 1
}

skip() {
  echo "vercel-ignore-build: skipping the build. $1"
  exit 0
}

# Fail safe: an unexpected error builds rather than skips.
trap 'build "Unexpected error on line $LINENO."' ERR

# Succeeds when a changed path can't affect the deployed site. The first
# matching pattern wins, so the carve-outs come before the broad rules.
is_non_app() {
  case $1 in
  # Unit tests sit beside the code they cover but never reach the bundle.
  src/*.test.ts | src/*.test.tsx) return 0 ;;
  # The rest of src/ is app code, including the Vite plugins in src/lib/ that
  # vite.config.ts imports. public/ is copied into the build as it is.
  src/* | public/*) return 1 ;;
  # A change to this script should prove itself with a build.
  scripts/vercel-ignore-build.sh) return 1 ;;
  # Tests, tooling and docs that never reach the deployed site.
  e2e/* | scripts/* | docs/* | docker/* | .github/* | .claude/*) return 0 ;;
  *.md) return 0 ;;
  docker-compose.yml | playwright.config.ts | eslint.config.js | .oxlintrc.json) return 0 ;;
  .prettierrc.json | .prettierignore | .mega-linter.yml) return 0 ;;
  .gitignore | .git-blame-ignore-revs) return 0 ;;
  # Everything else builds: the HTML entries (index.html, sources/,
  # methodology/), package.json and its lockfile, vite.config.ts,
  # tsconfig*.json, vercel.json, and any path this list doesn't know about.
  *) return 1 ;;
  esac
}

vercel_env=${VERCEL_ENV:-}
if [[ $vercel_env == production ]]; then
  build "Production deployments always build."
fi
if [[ $vercel_env != preview ]]; then
  build "VERCEL_ENV is '${vercel_env}', not 'preview'."
fi

# Vercel only sets this when an Ignored Build Step is configured. It's the
# commit of the branch's last successful deployment, so it covers every commit
# pushed since then, not just the newest one, and it's empty on a branch's
# first deployment.
prev=${VERCEL_GIT_PREVIOUS_SHA:-}
if [[ -z $prev ]]; then
  build "No previous deployment on this branch to compare with."
fi
if [[ ! $prev =~ ^[0-9a-f]{7,64}$ ]]; then
  build "VERCEL_GIT_PREVIOUS_SHA '${prev}' doesn't look like a commit SHA."
fi

# Vercel checks out the commit it's deploying, so the two are the same there.
# The override is what lets a local dry run compare any pair of commits.
current=${VERCEL_GIT_COMMIT_SHA:-HEAD}
if ! git rev-parse --verify --quiet "${current}^{commit}" >/dev/null; then
  build "Commit '${current}' isn't in this clone."
fi

# Vercel clones only the last ten commits, so a branch that moved on further
# than that since its last deployment won't have the previous commit locally.
# Comparing two trees doesn't need the history between them, so fetching that
# one commit is enough. If the fetch fails or stalls, build.
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  echo "vercel-ignore-build: ${prev} isn't in the shallow clone; fetching it."
  fetch=(git fetch --quiet --no-tags --depth=1 origin "$prev")
  if command -v timeout >/dev/null; then
    fetch=(timeout 60 "${fetch[@]}")
  fi
  if ! GIT_TERMINAL_PROMPT=0 "${fetch[@]}" || ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
    build "Couldn't get the previous deployment's commit ${prev}."
  fi
fi

# --no-renames lists a moved file under both its old and new path. With rename
# detection only the new path would show, so moving a file out of src/ would
# look like a non-app change. Paths git has to quote (control characters,
# quotes or backslashes) come out wrapped in double quotes, match no
# pattern above and so build.
changed=$(git -c core.quotePath=false diff-tree -r --name-only --no-renames "$prev" "$current")

if [[ -z $changed ]]; then
  skip "Nothing changed between ${prev} and ${current}."
fi

mapfile -t paths <<<"$changed"
for path in "${paths[@]}"; do
  if ! is_non_app "$path"; then
    build "${path} changed since ${prev} and could affect the deployed site."
  fi
done

echo "vercel-ignore-build: changed since ${prev}, none of them part of the deployed app:"
printf '  %s\n' "${paths[@]}"
skip "No app inputs changed."

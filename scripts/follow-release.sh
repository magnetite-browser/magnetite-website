#!/bin/sh
# Set LATEST_VERSION in src/site.ts to the browser's latest published
# release, through a pull request that merges by itself. Run by
# .github/workflows/follow-release.yml; needs `gh` signed in (GH_TOKEN) with
# write access to this repository. Does nothing when the version is current.
# A run that broke off half-way is taken up again by the next one: each step
# is skipped only when its result is there.
set -eu

cd "$(dirname "$0")/.."
line='^export const LATEST_VERSION: string | null = '
browser=$(sed -n 's/^export const GITHUB_REPO = "\(.*\)";$/\1/p' src/site.ts)
# `null` before the first release, else the version in quotes.
current=$(sed -n "s/$line\(.*\);\$/\1/p" src/site.ts | tr -d '"')
tag=$(gh api "repos/$browser/releases/latest" --jq .tag_name)
version=${tag#v}
# The value goes into a source file: nothing but a plain version.
if ! printf '%s\n' "$version" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+'; then
  echo "follow-release: unexpected release tag '$tag'" >&2
  exit 1
fi
if [ "$version" = "$current" ]; then
  echo "follow-release: $current is the latest release"
  exit 0
fi

branch="chore/release-$version"
title="chore: link release $version"
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  git fetch --quiet origin "$branch"
  head=$(git rev-parse FETCH_HEAD)
else
  sed -i.bak "s/\($line\).*;\$/\1\"$version\";/" src/site.ts
  rm src/site.ts.bak
  if ! grep -q "$line\"$version\";\$" src/site.ts; then
    echo "follow-release: no LATEST_VERSION line to set in src/site.ts" >&2
    exit 1
  fi
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git switch --quiet --create "$branch"
  git commit --quiet --all --message "$title"
  git push --quiet origin "$branch"
  head=$(git rev-parse HEAD)
fi
if [ -z "$(gh pr list --head "$branch" --state open --json number --jq '.[].number')" ]; then
  gh pr create --head "$branch" --title "$title" \
    --body "The browser's latest release is $version. Opened by the \"Follow the browser's release\" workflow; merges by itself once the check passed."
fi
# A pull request opened by a workflow starts no CI: start it, once.
if [ -z "$(gh api "repos/{owner}/{repo}/commits/$head/check-runs" --jq '.check_runs[].id')" ]; then
  gh workflow run ci.yml --ref "$branch"
fi
gh pr merge "$branch" --auto --squash

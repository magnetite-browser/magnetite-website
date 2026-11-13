#!/usr/bin/env bash
# Set LATEST_VERSION in src/site.ts to the browser's latest published
# release, through a pull request that merges by itself. Run by
# .github/workflows/follow-release.yml; needs `gh` signed in (GH_TOKEN) with
# write access to this repository. Does nothing when the version is current
# or its pull request is already open.
set -euo pipefail

cd "$(dirname "$0")/.."
browser=$(sed -n 's/^export const GITHUB_REPO = "\(.*\)";$/\1/p' src/site.ts)
current=$(sed -n 's/^export const LATEST_VERSION: string | null = "\(.*\)";$/\1/p' src/site.ts)
tag=$(gh api "repos/$browser/releases/latest" --jq .tag_name)
version=${tag#v}
# The value goes into a source file: nothing but a plain version.
if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "follow-release: unexpected release tag '$tag'" >&2
  exit 1
fi
if [[ $version == "$current" ]]; then
  echo "follow-release: $current is the latest release"
  exit 0
fi
branch="chore/release-$version"
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  echo "follow-release: the pull request for $version is open already"
  exit 0
fi

sed -i.bak "s/^\(export const LATEST_VERSION: string | null = \)\".*\";$/\1\"$version\";/" src/site.ts
rm src/site.ts.bak
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git switch --create "$branch"
git commit --quiet --all --message "chore: link release $version"
git push --quiet origin "$branch"
gh pr create --head "$branch" --title "chore: link release $version" \
  --body "The browser's latest release is $version. Opened by the \"Follow the browser's release\" workflow; merges by itself once the check passed."
gh workflow run ci.yml --ref "$branch"
gh pr merge "$branch" --auto --squash

#!/bin/sh
# Start a built image the way it should run (read-only, no capabilities) and
# check what a visitor relies on: the pages answer, an unknown address gets
# the 404 page, the security headers are there, built files are cached.
# The container is removed again afterwards.
#
# Usage: scripts/smoke-test.sh <image>      (DOCKER=podman to use Podman)
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <image>" >&2
  exit 2
fi
docker=${DOCKER:-docker}
name=magnetite-website-smoke
base=http://127.0.0.1:8080

trap '$docker rm --force "$name" >/dev/null 2>&1' EXIT
$docker run --detach --name "$name" --read-only --cap-drop ALL --publish 127.0.0.1:8080:8080 "$1" >/dev/null

for _ in $(seq 1 40); do
  curl --silent --output /dev/null --max-time 2 "$base/" && break
  sleep 0.5
done

fail() {
  echo "smoke test: $1" >&2
  $docker logs "$name" >&2
  exit 1
}
status() { curl --silent --output /dev/null --max-time 5 --write-out '%{http_code}' "$base$1"; }
header() { curl --silent --output /dev/null --max-time 5 --dump-header - "$base$1" | tr -d '\r' | awk -v name="$2" 'tolower($1) == tolower(name) ":" { sub(/^[^:]*: */, ""); print }'; }

for page in / /download/ /privacy/ /imprint/ /license/ /security/ /demo/ /favicons/roadmap.example.org.png; do
  [ "$(status "$page")" = 200 ] || fail "$page did not answer 200"
done
[ "$(status /no-such-page/)" = 404 ] || fail "an unknown address did not answer 404"
curl --silent --max-time 5 "$base/no-such-page/" | grep -q "<title>" || fail "an unknown address did not get the 404 page"
# The header is the pages' own policy (their <meta> tag) plus frame-ancestors.
meta=$(curl --silent --max-time 5 "$base/" | sed -n 's/.*http-equiv="Content-Security-Policy" content="\([^"]*\)".*/\1/p')
[ -n "$meta" ] || fail "the home page has no Content-Security-Policy meta tag"
[ "$(header / Content-Security-Policy)" = "$meta; frame-ancestors 'self'" ] ||
  fail "the Content-Security-Policy header (Caddyfile) differs from the pages' own (src/layouts/Base.astro)"
[ "$(header / X-Content-Type-Options)" = nosniff ] || fail "X-Content-Type-Options is missing"
[ -z "$(header / Server)" ] || fail "the Server header is sent"
script=$(curl --silent --max-time 5 "$base/" | grep -o '/_astro/[^"]*\.js' | head -n 1)
case "$(header "$script" Cache-Control)" in
  *immutable*) ;;
  *) fail "built files are not cached ($script)" ;;
esac
echo "smoke test: ok"

#!/usr/bin/env bash
# Run with: bash scripts/test_nginx_security.sh
# Requires: docker compose up -d (stack running on localhost:80)

set -euo pipefail

BASE="http://localhost"
PASS=0
FAIL=0

assert_header() {
    local label="$1" url="$2" header="$3" expected="$4"
    local actual
    actual=$(curl -sI "$url" | grep -i "^${header}:" | head -1 | tr -d '\r')
    if echo "$actual" | grep -qi "$expected"; then
        echo "  PASS  $label"
        ((PASS++)) || true
    else
        echo "  FAIL  $label"
        echo "        Expected header '$header' to contain '$expected'"
        echo "        Got: '$actual'"
        ((FAIL++)) || true
    fi
}

assert_status() {
    local label="$1" url="$2" expected_status="$3"
    local actual
    actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$actual" = "$expected_status" ]; then
        echo "  PASS  $label"
        ((PASS++)) || true
    else
        echo "  FAIL  $label"
        echo "        Expected status $expected_status, got $actual"
        ((FAIL++)) || true
    fi
}

assert_header_absent() {
    local label="$1" url="$2" header="$3"
    local actual
    actual=$(curl -sI "$url" | grep -i "^${header}:" | head -1 | tr -d '\r')
    if [ -z "$actual" ]; then
        echo "  PASS  $label"
        ((PASS++)) || true
    else
        echo "  FAIL  $label"
        echo "        Header '$header' should be absent, got: '$actual'"
        ((FAIL++)) || true
    fi
}

echo ""
echo "=== nginx Security Header Tests ==="
echo ""

echo "--- Root / ---"
assert_header "X-Frame-Options DENY on /"        "$BASE/"         "X-Frame-Options"        "DENY"
assert_header "X-Content-Type-Options on /"      "$BASE/"         "X-Content-Type-Options" "nosniff"
assert_header "Content-Security-Policy on /"     "$BASE/"         "Content-Security-Policy" "default-src"
assert_header "Cache-Control no-cache on /"      "$BASE/"         "Cache-Control"          "no-cache"

echo ""
echo "--- /index.html ---"
assert_header "X-Frame-Options on /index.html"   "$BASE/index.html" "X-Frame-Options"  "DENY"
assert_header "Cache-Control no-store /index.html" "$BASE/index.html" "Cache-Control"  "no-store"

echo ""
echo "--- /assets/ (hashed, immutable) ---"
ASSET_FILE=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)
if [ -n "$ASSET_FILE" ]; then
    assert_header "Cache-Control immutable on /assets/" "$BASE$ASSET_FILE" "Cache-Control" "immutable"
    assert_header "X-Frame-Options on /assets/"         "$BASE$ASSET_FILE" "X-Frame-Options" "DENY"
else
    echo "  SKIP  /assets/ check — no JS asset found in index.html"
fi

echo ""
echo "--- /api/ proxy headers ---"
assert_header "X-Frame-Options on /api/health/"  "$BASE/api/health/" "X-Frame-Options" "DENY"
assert_header_absent "No Server header on /api/" "$BASE/api/health/" "Server"
assert_header_absent "No X-Powered-By on /api/"  "$BASE/api/health/" "X-Powered-By"

echo ""
echo "--- Routing: /api/nonexistent must not return SPA ---"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/this-does-not-exist/")
if [ "$STATUS_CODE" = "404" ]; then
    echo "  PASS  /api/nonexistent returns 404"
    ((PASS++)) || true
else
    echo "  FAIL  /api/nonexistent returns $STATUS_CODE (expected 404)"
    ((FAIL++)) || true
fi

CONTENT=$(curl -s "$BASE/api/this-does-not-exist/")
if echo "$CONTENT" | grep -q "<!DOCTYPE html>"; then
    echo "  FAIL  /api/nonexistent returns SPA HTML (fallback leaking into /api/)"
    ((FAIL++)) || true
else
    echo "  PASS  /api/nonexistent is not SPA index.html"
    ((PASS++)) || true
fi

echo ""
echo "--- Source maps absent in production ---"
JS_FILE=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
    MAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE${JS_FILE}.map")
    if [ "$MAP_STATUS" = "404" ]; then
        echo "  PASS  .js.map returns 404 (source maps not exposed)"
        ((PASS++)) || true
    else
        echo "  FAIL  .js.map returns $MAP_STATUS (source maps may be exposed)"
        ((FAIL++)) || true
    fi
else
    echo "  SKIP  source map check — no JS asset found"
fi

echo ""
echo "--- Sensitive files not served ---"
assert_status ".env not served"            "$BASE/.env"              "404"
assert_status "docker-compose not served"  "$BASE/docker-compose.yml" "404"
assert_status "nginx.conf not served"      "$BASE/nginx.conf"        "404"

echo ""
echo "--- client_max_body_size (11MB > 10MB limit should return 413) ---"
BIG_FILE=$(mktemp)
dd if=/dev/zero bs=1M count=11 2>/dev/null > "$BIG_FILE"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login/" \
    -F "file=@$BIG_FILE" 2>/dev/null)
rm -f "$BIG_FILE"
if [ "$STATUS" = "413" ]; then
    echo "  PASS  11MB upload returns 413 Request Entity Too Large"
    ((PASS++)) || true
else
    echo "  FAIL  11MB upload returns $STATUS (expected 413)"
    ((FAIL++)) || true
fi

echo ""
echo "=============================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=============================="
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

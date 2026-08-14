#!/bin/bash
# Start dev server + run e2e test in the same bash session
set -e
cd /home/z/my-project

# Kill any existing server
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Start dev server in background, redirect output to log
rm -f dev.log
npm run dev > dev.log 2>&1 &
DEV_PID=$!
echo "Dev server PID: $DEV_PID"

# Wait for server to be ready (max 30 seconds)
echo "Waiting for dev server..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

# Verify server is up
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: server not ready (HTTP $HTTP_CODE)"
  tail -30 dev.log
  kill $DEV_PID 2>/dev/null || true
  exit 1
fi

# Run the e2e test
echo ""
echo "============================================================"
echo "  Forge AI — End-to-End AI Test"
echo "============================================================"
echo ""

BASE="http://localhost:3000"
COOKIES=/tmp/forge-cookies.txt
rm -f $COOKIES

echo "[1/5] Signing in as admin@forge.ai ..."
CSRF=$(curl -s -c "$COOKIES" -b "$COOKIES" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
echo "  CSRF: $CSRF"
curl -s -b "$COOKIES" -c "$COOKIES" -L -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "email=admin@forge.ai&password=demo1234&csrfToken=$CSRF&callbackUrl=$BASE&json=true" \
  -o /dev/null -w "  Sign-in HTTP %{http_code}\n"
SESSION=$(curl -s -b "$COOKIES" "$BASE/api/auth/session")
echo "  Session: $(echo $SESSION | head -c 200)..."
echo ""

# Test AI research
echo "[2/5] Testing AI research (basic) on stripe.com ..."
RESEARCH_RES=$(curl -s --max-time 60 -b "$COOKIES" -X POST "$BASE/api/research" \
  -H "Content-Type: application/json" \
  -d '{"website":"https://stripe.com","company":"Stripe","mode":"basic"}')
echo "  Response (first 800 chars):"
echo "$RESEARCH_RES" | head -c 800
echo ""
echo ""

# Create lead
echo "[3/5] Creating a lead ..."
LEAD_RES=$(curl -s -b "$COOKIES" -X POST "$BASE/api/leads" \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme Corp","website":"https://acme.test","industry":"SaaS","contactName":"John Doe","title":"VP Sales"}')
echo "  Lead response: $(echo $LEAD_RES | head -c 200)"
LEAD_ID=$(echo $LEAD_RES | sed -E 's/.*"id":"([^"]+)".*/\1/' | head -c 30)
echo "  Lead ID: $LEAD_ID"
echo ""

# Test email generation
echo "[4/5] Testing email generation ..."
EMAIL_RES=$(curl -s --max-time 60 -b "$COOKIES" -X POST "$BASE/api/generate-email" \
  -H "Content-Type: application/json" \
  -d "{\"leadId\":\"$LEAD_ID\",\"senderName\":\"Alice\",\"senderCompany\":\"Forge\",\"senderProduct\":\"AI prospecting\",\"tone\":\"professional\",\"language\":\"en\"}")
echo "  Response (first 800 chars):"
echo "$EMAIL_RES" | head -c 800
echo ""
echo ""

# Test auto-prospect (small target)
echo "[5/5] Testing auto-prospect (target=3, synchronous) ..."
AUTOPROSPECT_RES=$(curl -s --max-time 180 -b "$COOKIES" -X POST "$BASE/api/auto-prospect" \
  -H "Content-Type: application/json" \
  -d "{\"targetCount\":3,\"saveToDb\":false,\"serviceName\":\"B2B SaaS lead generation tool\",\"description\":\"AI-powered cold outreach platform for VP Sales at SaaS companies\"}")
echo "  Response (first 1000 chars):"
echo "$AUTOPROSPECT_RES" | head -c 1000
echo ""

echo ""
echo "============================================================"
echo "  Test complete."
echo "============================================================"

# Kill dev server
kill $DEV_PID 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

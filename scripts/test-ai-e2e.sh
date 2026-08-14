#!/bin/bash
# End-to-end test of all AI features after the bug fix.
# Run after `npm run dev` is up.

set -e
BASE="http://localhost:3000"
COOKIES=/tmp/forge-cookies.txt

echo "============================================================"
echo "  Forge AI — End-to-End AI Test"
echo "============================================================"
echo ""

# 1. Sign in
echo "[1/5] Signing in as admin@forge.ai ..."
CSRF=$(curl -s -c "$COOKIES" -b "$COOKIES" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -s -b "$COOKIES" -c "$COOKIES" -L -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "email=admin@forge.ai&password=demo1234&csrfToken=$CSRF&callbackUrl=$BASE&json=true" \
  -o /dev/null -w "  HTTP %{http_code}\n"
SESSION=$(curl -s -b "$COOKIES" "$BASE/api/auth/session")
echo "  Session: $(echo $SESSION | head -c 120)..."
echo ""

# 2. Web search (Tavily or Z.ai)
echo "[2/5] Testing web_search ..."
SEARCH_RES=$(curl -s -b "$COOKIES" -X POST "$BASE/api/web-search" \
  -H "Content-Type: application/json" \
  -d '{"query":"best B2B SaaS companies in fintech","num":3}')
echo "  Response (first 300 chars): $(echo $SEARCH_RES | head -c 300)..."
echo ""

# 3. AI research (basic)
echo "[3/5] Testing AI research (basic mode) on https://stripe.com ..."
RESEARCH_RES=$(curl -s -b "$COOKIES" -X POST "$BASE/api/research" \
  -H "Content-Type: application/json" \
  -d '{"website":"https://stripe.com","company":"Stripe","mode":"basic"}')
echo "  Response (first 500 chars):"
echo "  $(echo $RESEARCH_RES | head -c 500)"
echo ""

# 4. Create a lead, then generate email
echo "[4/5] Creating a test lead ..."
LEAD_RES=$(curl -s -b "$COOKIES" -X POST "$BASE/api/leads" \
  -H "Content-Type: application/json" \
  -d '{"company":"Test Company","website":"https://example.com","industry":"SaaS"}')
LEAD_ID=$(echo $LEAD_RES | sed -E 's/.*"id":"([^"]+)".*/\1/' | head -c 30)
echo "  Lead created: $LEAD_ID"
echo ""

echo "[5/5] Testing email generation on the lead ..."
EMAIL_RES=$(curl -s -b "$COOKIES" -X POST "$BASE/api/generate-email" \
  -H "Content-Type: application/json" \
  -d "{\"leadId\":\"$LEAD_ID\",\"senderName\":\"Alice\",\"senderCompany\":\"Forge\",\"senderProduct\":\"AI prospecting\",\"tone\":\"professional\",\"language\":\"en\"}")
echo "  Response (first 500 chars):"
echo "  $(echo $EMAIL_RES | head -c 500)"
echo ""

echo "============================================================"
echo "  Test complete."
echo "============================================================"

#!/bin/bash
# Run this script to set all Vercel environment variables
# Usage: bash scripts/setup-vercel-env.sh

echo "=== Setting Vercel Environment Variables ==="

# You need to install Vercel CLI first: npm i -g vercel
# Then run: vercel login
# Then run this script from the project root

PROJECT_ID="prj_..." # Replace with your Vercel project ID

ENV_VARS=(
  "DATABASE_URL=postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  "DIRECT_DATABASE_URL=postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
  "NEXTAUTH_SECRET=slFRCmo4rBARt3s/57LXLTRC+S0CLTMNxeJTxdy8rmI="
  "NEXTAUTH_URL=https://leadforge-ai-614m.vercel.app"
  "GEMINI_API_KEY=AQ.Ab8RN6LgyOkf8W0FjGSH2UkAVhYZai3V8taC312WegqCLvoALw"
  "TAVILY_API_KEY=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"
  "JINA_API_KEY=jina_b1d00230734a4e4b9d6fdc03ea4c7614v5fYdahQNZjvtzm6nWq3Wkor8_6I"
)

for var in "${ENV_VARS[@]}"; do
  KEY="${var%%=*}"
  VALUE="${var#*=}"
  echo "Setting $KEY..."
  echo "$VALUE" | vercel env add "$KEY" production preview 2>/dev/null || echo "  (may already exist)"
done

echo ""
echo "=== Done! Now redeploy: vercel --prod ==="

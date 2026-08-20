#!/bin/bash
# Set Vercel environment variables. Reads values from the local .env file so
# real secrets never get committed to git.
# Usage: bash scripts/setup-vercel-env.sh
#
# Prereqs: npm i -g vercel && vercel login, then run from project root.

echo "=== Setting Vercel Environment Variables ==="

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Create it first (see .env.example or local setup)."
  exit 1
fi

get() { grep -E "^${1}=" .env | head -n1 | cut -d= -f2-; }

PROJECT_ID="${VERCEL_PROJECT_ID:-prj_...}"

ENV_VARS=(
  "DATABASE_URL=$(get DATABASE_URL)"
  "DIRECT_DATABASE_URL=$(get DIRECT_DATABASE_URL)"
  "NEXTAUTH_SECRET=$(get NEXTAUTH_SECRET)"
  "NEXTAUTH_URL=https://leadforge-ai-614m.vercel.app"
  "GEMINI_API_KEY=$(get GEMINI_API_KEY)"
  "TAVILY_API_KEY=$(get TAVILY_API_KEY)"
  "JINA_API_KEY=$(get JINA_API_KEY)"
  "GROQ_API_KEY=$(get GROQ_API_KEY)"
  "DEEPSEEK_API_KEY=$(get DEEPSEEK_API_KEY)"
  "OPENCODE_API_KEY=$(get OPENCODE_API_KEY)"
)

for var in "${ENV_VARS[@]}"; do
  KEY="${var%%=*}"
  VALUE="${var#*=}"
  if [ -z "$VALUE" ] || [ "$VALUE" = "$KEY" ]; then
    echo "SKIP $KEY (empty in .env)"
    continue
  fi
  echo "Setting $KEY..."
  echo "$VALUE" | vercel env add "$KEY" production preview 2>/dev/null || echo "  (may already exist)"
done

echo ""
echo "=== Done! Now redeploy: vercel --prod ==="
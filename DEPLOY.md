# Deployment Guide (Vercel)

This app's AI enrichment pipeline depends on runtime environment variables.
Vercel **does NOT read your committed `.env`** — it only uses env vars set in
the dashboard. Without a working chat key, the LLM extraction fails and the
app silently returns **0 decision makers** for most companies.

## Prerequisites

- Node.js 18+
- A Vercel account
- A Postgres database (e.g. Supabase, Neon) — the `vercel-build` script runs
  `prisma db push` automatically, so no manual migration needed on deploy.

## 1. Environment variables (critical)

In **Vercel Dashboard → Project → Settings → Environment Variables**, set all
of the following for **Production** (and Preview):

| Variable | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Postgres provider | DB connection (pooled URL, e.g. `?pgbouncer=true`) |
| `DIRECT_DATABASE_URL` | Postgres provider | Direct (non-pooled) connection |
| `NEXTAUTH_SECRET` | generate one | Login/session encryption |
| `NEXTAUTH_URL` | your domain | `https://<your-app>.vercel.app` |
| `GROQ_API_KEY` | Groq console | **Chat LLM — the critical key** |
| `DEEPSEEK_API_KEY` | DeepSeek platform | chat fallback #2 |
| `OPENCODE_API_KEY` | opencode.ai billing | chat fallback #3 |
| `JINA_API_KEY` | jina.ai | search + page reader |
| `TAVILY_API_KEY` | tavily.com | search fallback |
| `GEMINI_API_KEY` | Google AI Studio | last chat fallback |

> The chat ladder is `groq,deepseek,opencode,openrouter,gemini,openai,anthropic`.
> If none of the top keys are set on Vercel, every LLM call throws
> "all chat providers unavailable" and the pipeline falls back to regex
> extraction → 0 decision makers.

### Fastest way to set them

```bash
npm i -g vercel
vercel login
bash scripts/setup-vercel-env.sh   # reads keys from your local .env
vercel --prod                       # redeploy
```

The script reads each key from `.env` (never commits secrets to git) and
adds them to Production + Preview.

## 2. Deploy

```bash
git push origin main
```

`vercel-build` automatically:
1. switches the Prisma schema to `postgres`
2. regenerates the Prisma client
3. runs `prisma db push --accept-data-loss` (creates/updates tables)

## 3. Seed the database (once, after first deploy)

Run from your machine pointing at the Postgres DB:

```bash
npx prisma db push
npx tsx scripts/seed.ts
```

This creates the demo tenant + users and demo leads:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@outrovo.com` | `demo1234` |
| Manager | `manager@outrovo.com` | `demo1234` |
| SDR | `sdr@outrovo.com` | `demo1234` |

Without a seeded tenant you have no login account and no credit balance —
enrichment will fail with "AI 點數不足".

## 4. Verify

- Open the deployed app → log in → open a lead → click "查找 Email" (enrich).
- Check Vercel function logs for `POST /api/enrich-email`. A successful run
  shows `200` with `totalFound > 0`.
- If it still returns 0, check:
  1. `GROQ_API_KEY` is set in the dashboard (not just `.env`).
  2. The deploy includes the latest commit (`maxDuration = 60` on the
     enrich route — without it Vercel Hobby kills the function at 10s while
     enrichment takes 30–60s).

## Known Vercel limitation

Outbound SMTP port 25 is **blocked** on Vercel serverless functions, so the
SMTP mailbox check (`smtp_check`) will always be `unknown` on Vercel. Emails
are still found and format-predicted — they just won't be SMTP-verified there.
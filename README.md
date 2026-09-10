# ResolveAI (SmartResolve)

AI-powered complaint classification & research platform — Next.js 16, React 19, Tailwind 4, PostgreSQL + MongoDB, with an animated Deadpool-themed UI.

## Local development

```bash
npm install
cp .env.example .env   # fill in your real values
npm run dev            # http://localhost:3000
```

## Deploy to Vercel (2 minutes)

The repo is pre-configured (`vercel.json` + `.env.example`).

1. Push this repo to GitHub (already done: `Ashvanth2004/SmartResolve`).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the `SmartResolve` repo.
3. Vercel auto-detects Next.js — leave build settings as-is (`npm run build`).
4. Before clicking Deploy, open **Environment Variables** and add the variables from `.env.example` with your **real** values. Required at minimum:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your hosted PostgreSQL URL (Neon/Supabase) |
   | `MONGODB_URI` | your MongoDB Atlas URI |
   | `NEXTAUTH_URL` | `https://<your-app>.vercel.app` (add after first deploy, or your custom domain) |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXT_PUBLIC_BASE_URL` | same as `NEXTAUTH_URL` |
   | `GEMINI_API_KEY` / `OPENAI_API_KEY` | your AI provider key |
   | `SMTP_*` | your mail server creds (for verification emails) |

5. Click **Deploy**. Every future `git push` to `main` auto-deploys.

> Tip: set `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` in two steps — deploy once to get the URL, then add the variables and redeploy.

## Build & run in production locally

```bash
npm run build
npm start
```

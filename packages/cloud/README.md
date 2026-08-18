# CodeTutor Cloud

Isolated account, billing, and managed-AI API for CodeTutor. It never accesses learner repositories. Local lessons and BYOK providers continue to work without a paid plan.

## Setup

1. Create a Supabase project.
2. Apply every file in `supabase/migrations` in filename order.
3. Enable email magic links, Google, and GitHub in Supabase Auth.
4. Set the variables from `.env.example` in a separate Vercel project rooted at `packages/cloud`.
5. Add the deployed cloud origin and the browser app callback URL to the Supabase redirect allowlist.
6. Connect Stripe in sandbox mode and create recurring monthly prices for Starter ($12) and Pro ($29).
7. Set the Stripe price IDs and `STRIPE_WEBHOOK_SECRET` in Vercel, then send Stripe events to `/api/billing/webhook`.
8. Keep Vercel's project AI Gateway budget enabled. Production uses the automatically injected `VERCEL_OIDC_TOKEN`; local development can use a budget-limited `AI_GATEWAY_API_KEY`.

`SUPABASE_SECRET_KEY` is server-only. Never add it to a `VITE_*` variable. The legacy `SUPABASE_SERVICE_ROLE_KEY` name is accepted during migration.

## Plans and hard limits

| Plan | Price | Requests/month | Tokens/month | AI spend/month | RPM | Concurrent | Models |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Free | $0 | 0 | 0 | $0 | 0 | 0 | BYOK only |
| Starter | $12 | 1,000 | 2,000,000 | $5 | 10 | 2 | Gemini 3.1 Flash Lite |
| Pro | $29 | 4,000 | 8,000,000 | $15 | 30 | 4 | Gemini 3.1 Flash Lite, GPT-5.4 Mini |

The first limit reached stops new managed-AI requests until the next UTC calendar month. The database reserves quota before a request and reconciles actual usage when the response finishes. Vercel's separate project/team budget is the final circuit breaker.

Stripe must remain in sandbox mode until checkout, signed webhook delivery, cancellation, plan changes, quota rejection, and customer-portal flows have all passed. Never place `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or an AI Gateway key in a `VITE_*` variable.

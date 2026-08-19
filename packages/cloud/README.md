# CodeTutor Cloud

Isolated account, billing, and managed-AI API for CodeTutor. It never accesses learner repositories. Local lessons continue to work offline, while every AI request is routed through the CodeTutor AI Gateway.

## Setup

1. Create a Supabase project.
2. Apply every file in `supabase/migrations` in filename order.
3. Enable email magic links, Google, and GitHub in Supabase Auth.
4. Set the variables from `.env.example` in a separate Vercel project rooted at `packages/cloud`.
5. Add the deployed cloud origin and the browser app callback URL to the Supabase redirect allowlist.
6. Connect Stripe in sandbox mode and run `bun run setup:stripe` to create the recurring plans, prepaid credit packs, customer portal, and webhook configuration.
7. Set every returned Stripe price ID and `STRIPE_WEBHOOK_SECRET` in Vercel, then send Stripe events to `/api/billing/webhook`.
8. Keep Vercel's project AI Gateway budget enabled. Production uses the automatically injected `VERCEL_OIDC_TOKEN`; local development can use a budget-limited `AI_GATEWAY_API_KEY`.

`SUPABASE_SECRET_KEY` is server-only. Never add it to a `VITE_*` variable. The legacy `SUPABASE_SERVICE_ROLE_KEY` name is accepted during migration.

## Plans and hard limits

| Plan | Price | Requests/month | Tokens/month | AI credit/month | RPM | Concurrent | Models |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Free | $0 | 250 | 1,000,000 | $0.50 | 5 | 1 | All supported language models |
| Starter | $12 | 5,000 | 20,000,000 | $6 | 20 | 2 | All supported language models |
| Pro | $29 | 20,000 | 100,000,000 | $18 | 60 | 4 | All supported language models |

Private managed-AI overrides are stored in the service-role-only `managed_ai_overrides` table. An unlimited override removes CodeTutor account-level quotas and unlocks every managed model, while the Vercel AI Gateway project budget remains the final spending safety boundary. Overrides are not public plans and cannot be purchased through checkout.

The model catalog comes from Vercel AI Gateway and uses actual upstream model names. Tool-capable language models run full coding sessions, language models without tools run in chat-only mode, and non-language or unpriced models remain visible but unavailable. BYOK, provider OAuth, local-model, and plugin-added model registration are deferred; legacy provider credentials are quarantined locally until the user explicitly exports or removes them.

Plans control allowances rather than model visibility. Paid usage resets with the Stripe billing period; Free resets by UTC calendar month. Starter and Pro may buy $5, $10, or $25 prepaid AI-credit packs for $7, $13, or $32. Included credit is consumed first, then the earliest-expiring top-up. Top-ups expire after 12 months.

The database atomically reserves requests, tokens, included credit, and prepaid credit before contacting the Gateway, then reconciles actual usage from Gateway metadata. The first exhausted allowance stops new managed-AI requests. Vercel's separate project/team budget remains the final circuit breaker.

Stripe must remain in sandbox mode until checkout, signed webhook delivery, cancellation, plan changes, quota rejection, and customer-portal flows have all passed. Never place `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or an AI Gateway key in a `VITE_*` variable.

Before any public deployment, follow [the production launch runbook](./docs/launch-runbook.md). Previously exposed credentials must be rotated rather than copied into the new environment.

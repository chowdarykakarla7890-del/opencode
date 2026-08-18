# CodeTutor on Vercel

Create three Vercel projects from this repository. Set the production branch to `dev` for every project.

| Project | Root directory | Framework | Production domain |
| --- | --- | --- | --- |
| `codetutor-docs` | `packages/web` | Astro | `codetutor-docs.vercel.app` |
| `codetutor-app` | `packages/app` | Vite | `codetutor-app-red.vercel.app` |
| `codetutor-cloud` | `packages/cloud` | Other | generated Vercel domain |

Set `VITE_DEFAULT_SERVER_URL=http://localhost:4096` in the browser app project for Production, Preview, and Development. Preview origins are intentionally not accepted by the local server unless the learner starts it with an explicit `--cors https://<preview-host>` value.

Current Chromium releases ask the learner to allow local network access before a public HTTPS app can reach the loopback CodeTutor server. The learner must approve that browser prompt; CodeTutor still validates the exact production origin with CORS.

The browser app is static and uses SPA rewrites. The documentation project is static Astro. `codetutor web` continues to serve the embedded same-origin app and does not depend on Vercel.

The cloud project contains CodeTutor account, billing, managed-AI metering, and opt-in progress-sync functions. Connect it to a separate Supabase project, apply the migrations in `packages/cloud/supabase/migrations` in order, and configure its server-only values from `packages/cloud/.env.example`. Do not expose `SUPABASE_SECRET_KEY`, Stripe secrets, or the AI Gateway key to the browser.

When the account rollout is ready, set these variables on the browser app and desktop builds:

- `VITE_CODETUTOR_ACCOUNT_ENABLED=1`
- `VITE_CODETUTOR_ACCOUNT_URL=https://<cloud-project-domain>`
- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>`

Keep `CODETUTOR_SYNC_ENABLED=0` on the cloud project until conflict, recovery, and end-to-end sync tests are complete. Keep Stripe in sandbox mode until checkout, signed webhook delivery, plan changes, cancellation, and customer-portal flows pass against the production deployment.

The shorter `codetutor-app.vercel.app` alias is owned by another Vercel account, so this project uses Vercel's generated `codetutor-app-red.vercel.app` production alias.

# CodeTutor production launch runbook

This runbook is a release gate. Do not promote a preview deployment or publish a stable client while any required item is incomplete.

## 1. Credential reset and environment isolation

- Rotate every Supabase secret, legacy provider key, Vercel/Gateway credential, Stripe secret, npm credential, deploy token, and OAuth client secret that has appeared in chat, logs, screenshots, shell history, or repository history.
- Use distinct Supabase, Stripe, Vercel, OAuth, Resend, and Gateway resources for preview and production.
- Store server secrets only in the cloud project. Browser variables may contain only the Supabase URL and publishable key.
- Enable Vercel AI Gateway budgets and alerts before enabling `managed_ai` in remote configuration.
- Configure npm trusted publishing for this repository and release workflow. Do not restore a long-lived npm token.

## 2. Supabase and authentication

- Apply migrations in filename order and verify their checksums in preview first.
- Enable point-in-time recovery sufficient for a 15-minute RPO and document a restore owner capable of meeting the four-hour RTO.
- Verify RLS using two ordinary users plus service-role negative tests.
- Configure GitHub and Google OAuth, email magic links, Resend custom SMTP, redirect allowlists, CAPTCHA/risk challenges, and disposable-email controls.
- Verify 15-minute access tokens, refresh rotation, 30-day maximum session age, four-hour strict idle expiry, TOTP enrollment, AAL2 step-up, session revocation, and the seven-day deletion recovery process.
- Create the first Superadmin through an audited database procedure, then require MFA for all admin roles.

## 3. Billing and managed AI

- Run `bun run setup:stripe` from `packages/cloud` against Stripe test mode and save the generated IDs in the preview environment.
- Enable Stripe Tax and configure the customer portal, cancellation terms, refund policy, renewal disclosure, and top-up credit expiry disclosure.
- Deliver and replay every subscribed webhook. Confirm idempotency for checkout, subscription changes, cancellation, refund, dispute, and top-up grants.
- Exercise Free, Starter, Pro, private override, every hard limit, cost confirmation, concurrent reservation, failed stream release, and actual `gatewayCost` reconciliation.
- Confirm model catalog stale fallback and that chat-only models never receive repository tools.

## 4. Client and local-server acceptance

- Verify signed-out help, lessons, scaffolding, hints, checks, and local progress.
- Verify account login, vault-only token storage, refresh rotation, strict login, profile, sessions, service keys, usage, billing, export, and deletion in CLI, TUI, desktop, and hosted web.
- Verify the exact-origin hosted-web/local-server pairing flow end to end: request, account-bound CLI approval, token delivery, persisted connection, 30-day expiry, app revocation, CLI revocation, and rejected cross-origin replay. Do not advertise hosted repository access until this acceptance test passes.
- Test repository edit and shell confirmation, plus distinct destructive, external-path, elevated, and network approvals.
- Test macOS arm64/x64, Windows arm64/x64, and Linux arm64/x64. Stable desktop promotion additionally requires Apple notarization and Windows code signing.

## 5. Release and response readiness

- Publish Terms, Privacy, Acceptable Use, refund, subprocessors, retention, age, and GDPR/UK request documents reviewed by qualified counsel.
- Publish the status page and on-call escalation path; run one restore drill and one credential-revocation drill.
- Tag `v0.2.0-beta.1`. The workflow must produce provenance, SBOM, SHA-256 manifest, signature bundle, install-tested npm artifacts, and desktop artifacts.
- Promote the exact tested artifacts. Do not rebuild between beta acceptance and stable promotion.
- Keep rollback switches for authentication enforcement, managed AI, billing, catalog refresh, synchronization, fraud challenges, and local pairing.

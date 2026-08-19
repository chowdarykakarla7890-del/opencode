# CodeTutor incident response

1. Declare severity and name an incident commander, communications owner, and technical lead.
2. Disable the narrowest relevant rollback switch. Gateway budget exhaustion is the final managed-AI circuit breaker.
3. Revoke affected service keys, account sessions, OAuth clients, deployment credentials, or release artifacts. Never request learner prompts or repositories because CodeTutor Cloud does not retain them.
4. Preserve sanitized logs, immutable admin audit events, Stripe event IDs, Supabase audit records, and deployment identifiers.
5. Publish status updates with impact, start time, affected CodeTutor-owned services, and known workarounds. Separate upstream model incidents from CodeTutor availability.
6. Restore from the latest verified backup when necessary. The target RPO is 15 minutes and target RTO is four hours.
7. Notify affected users and authorities according to applicable legal timelines. Prioritize security and billing reports.
8. Complete a blameless review with containment, root cause, corrective actions, owners, dates, and a restore/revocation test.

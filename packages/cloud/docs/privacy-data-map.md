# CodeTutor cloud data map

CodeTutor Cloud may retain profile preferences, synchronized learning progress, account/device session metadata, billing state, service-key hashes and budgets, aggregate model/token/cost/latency/outcome measurements, notifications, fraud signals, deletion state, and immutable audit events.

CodeTutor Cloud must not retain prompts, source code, repository paths, file contents, tool inputs or outputs, command text, AI responses, or local transcripts. Those remain on the learner's device unless the learner explicitly exports them.

Diagnostics are opt-in. Scrubbing occurs before transport and removes code, prompts, paths, credentials, tokens, email addresses, and other direct personal identifiers. Request IDs used for usage reconciliation must not encode user data.

Service keys are stored only as hashes. CLI refresh credentials use the operating system vault. Desktop credentials use Electron `safeStorage`; Linux deployments must reject the `basic_text` backend. If secure storage is unavailable, the client requires a fresh browser authorization and does not write plaintext credentials.

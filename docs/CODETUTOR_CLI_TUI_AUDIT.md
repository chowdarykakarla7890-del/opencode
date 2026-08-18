# CodeTutor CLI/TUI preservation audit

## Protected contract

This cleanup preserves the existing CodeTutor teaching product and treats the following as compatibility boundaries:

- every CLI command, option, exit behavior, help snapshot, provider flow, and project-directory selection;
- the Tutor agent instructions, learner levels, 43 lesson manifests, starter files, hints, solutions, and deterministic checks;
- learner database tables, progress transitions, local storage paths, and reset confirmation;
- TUI routes, keybindings, callbacks, plugin slots, focus behavior, mouse behavior, permission decisions, themes, and snapshots;
- public exports, configuration fields, API and SDK types, internal `@opencode-ai/*` service identifiers, and generated code.

No source file, function, export, interface parameter, compatibility branch, or intentional teaching `TODO` is removed by this cleanup.

## Baseline

The audit began from a dirty worktree containing 1,702 tracked changes and 36 untracked files. Those changes are user-owned and are not reverted or broadly reformatted.

| Check | Baseline result |
| --- | --- |
| CodeTutor branding audit | Passed; 6,588 files checked |
| Curriculum typecheck and tests | Passed; all 43 manifests and lesson solutions validated |
| CLI learning lifecycle | Passed; start, resume, failed check, hints, solution diff, successful check, and reset covered |
| CLI help contract | Passed; 41 snapshots |
| TUI typecheck and complete tests | Passed; 201 passed, 1 pre-existing skip |
| Core typecheck and complete tests | Passed |
| Targeted Oxlint | Zero errors; 251 warnings before cleanup |
| Patch integrity | `git diff --check` passed |

## Findings

### Resolved

- **P2, high confidence — first-run KV noise:** a missing optional `kv.json` was reported as an error even though absence is the normal first-run state. Only `ENOENT` is now treated as expected; malformed JSON and other filesystem failures are still reported. A characterization test covers both paths.
- **P2, high confidence — prompt-history decoding:** valid JSON was trusted as `PromptInfo` without checking its runtime shape. History loading now retains valid entries unchanged and ignores malformed entries through a narrow type guard, matching the existing recovery behavior for invalid JSON.
- **P3, high confidence — implicit return warnings:** clipboard fallbacks and learning command handlers now return `undefined` explicitly. This clarifies their existing contract without changing output, exit behavior, provider selection, or process execution.

### Deferred without deletion

- **P2, medium confidence — generic persisted JSON assertions:** the generic persistence reader still trusts the caller's requested shape. Changing that public internal utility requires per-caller schemas and remains deferred; prompt history now validates its own persisted boundary.
- **P2, medium confidence — broad TUI assertions:** editor, theme, route, and session rendering contain type assertions tied to generated SDK and Solid/OpenTUI types. They remain unchanged because removing them safely requires upstream type-boundary work.
- **P3, high confidence — unused compatibility surfaces:** lint identifies unused parameters, presentation values, shortcut values, and an empty compatibility module. They are retained because they may be plugin, layout, or future compatibility surfaces.
- **P3, high confidence — test-only lint warnings:** fixtures intentionally use narrow assertions and unused service stubs. They remain unchanged to avoid weakening behavioral coverage.
- **P3, high confidence — intentional `TODO` markers:** curriculum starter templates and locked tool-contract tests deliberately contain `TODO` text. They are teaching content or compatibility sentinels, not cleanup candidates.

## Security and behavior review

- Lesson reset remains force-confirmed, uses the validated bundled lesson ID, and stays inside the CodeTutor data directory.
- Lesson validation remains deterministic and authoritative; AI feedback cannot mark a failed exercise complete.
- Solution reveal continues to record the event and display diffs without overwriting learner files.
- General CLI/TUI editing continues to use the directory supplied when CodeTutor starts; lesson sessions intentionally use their isolated lesson workspace.
- Provider credentials, model selection, permission evaluation, and tool execution paths are unchanged.

## Change policy

Future cleanup should remain incremental: add characterization coverage first, change one internal boundary at a time, run package-local typechecks and tests, and reject any diff that changes the protected contract. Suspected dead code should stay report-only unless deletion is separately authorized.

## Final verification

| Package or check | Final result |
| --- | --- |
| Curriculum | Typecheck passed; 4 tests passed |
| TUI | Typecheck passed; 203 tests passed, 1 pre-existing skip, 11 snapshots |
| Session UI | Typecheck passed; 83 tests passed |
| Core | Typecheck passed; 1,089 tests passed |
| CLI runtime package | Typecheck passed; 3,275 tests passed, 22 skips, 1 existing todo, 57 snapshots |
| Server | Typecheck passed |
| Targeted Oxlint | 243 warnings, 0 errors; down from 251 without deleting compatibility code |
| CodeTutor branding audit | Passed; 6,590 files checked |
| Patch integrity | `git diff --check` passed |

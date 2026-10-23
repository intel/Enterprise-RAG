# Review rules

Claude applies these when reviewing pull requests. A PR gets `Verdict: LGTM` only if all hold.

1. **Minimal code.** No code for hypothetical needs, no unused parameters, no scaffolding "for later". If a change can be smaller and still correct, say where.
2. **Easy to read over clever.** Straightforward control flow and plain names beat abstraction. Flag any interface with one implementation, factory for one product, or config for a value that never changes.
3. **SOLID and DRY.** One responsibility per module, class, chart template, or script. Repeated blocks become a function, helper template, or shared module. Dependencies injected, not hard-coded.
4. **No or minimal comments.** Code explains itself. A comment is justified only for a non-obvious constraint (external bug, protocol quirk, security reason). Flag comments that restate the code.
5. **Correctness first.** Bugs, committed secrets, unhandled errors on external calls, Helm values without defaults, and missing tests for changed behavior always outrank style and are always `needs changes`.
6. **Integrity.** Changes fit the existing structure of the component (microservice layout, Helm chart conventions, UI module patterns) and follow the patterns already present.

Report all findings, each with `file:line`, ordered by severity. No praise, no diff summary.
Group them for easier reading if more than 10.

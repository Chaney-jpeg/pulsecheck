# Engineering standards

- Keep modules small and organized around product behavior. Prefer explicit types and clear control flow.
- Validate at API boundaries and keep business rules in service functions.
- Keep credentials out of source; use environment variables. Treat monitored URLs as untrusted and add SSRF defenses before serving untrusted users.
- Handle timeouts and expected failures explicitly; do not swallow unexpected exceptions.
- Add focused tests for behavior changes and document public APIs and setup.
- Make incremental changes that preserve user work. Report checks run and any gaps.
- Do not commit, push, deploy, or perform destructive data operations without explicit authorization.

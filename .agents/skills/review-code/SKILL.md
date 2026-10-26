---
name: review-code
description: Review code changes for correctness, security, maintainability, and missing tests. Use when reviewing a diff or implementation before delivery.
---

# Code review

Review the requested change as a careful maintainer. Prioritize actionable defects over style preferences.

## Process
1. Read repository guidance and inspect the complete diff plus relevant callers and tests.
2. Trace changed behavior through inputs, state changes, error paths, and outputs.
3. Check validation, authorization, secrets, injection, unsafe network or file access, and data exposure.
4. Check concurrency, retries, timeouts, resource cleanup, and compatibility where relevant.
5. Check that tests cover meaningful success, failure, and boundary behavior.
6. Report only findings introduced by the change, ordered by severity, with file, line, impact, and a concrete fix.

## Output
- List findings first with severity (`P1`, `P2`, `P3`) and precise locations.
- Explain the triggering condition and user impact plainly.
- If there are no findings, state that and mention residual risks or test gaps.
- Do not rewrite code unless asked. Do not invent findings based only on hypothetical usage.

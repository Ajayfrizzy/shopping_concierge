# Codex Execution Protocol

This repository is designed so the user does not need to issue milestone-by-milestone implementation prompts.

## Initial instruction to Codex
A short instruction such as the following should be enough:

> Read AGENTS.md and all source-of-truth docs. Start at the first incomplete milestone in docs/MILESTONES.md. Use the relevant .codex skills, implement against the acceptance criteria, run tests, and stop only when the current milestone is complete or you hit a concrete blocker that requires external credentials/decision. Do not skip ahead.

## On subsequent sessions
Codex should inspect repository state, test results, milestones, and docs, then continue the first incomplete acceptance criteria.

## Human role after setup
The human primarily:
- supplies credentials when live integration is reached
- tests device UX
- reports defects or product changes
- approves major product/scope decisions
- records final demo

Persistent rules belong in docs/skills/tests, not repeated chat prompts.

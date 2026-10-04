# Implementation Checklist

- [x] M0 repository foundation — physical Android launch and API success/error/retry verified 2026-10-02; see `VALIDATION.md`
- [x] M1 domain + decision engine — scoped-state acceptance regressions, 103 tests, typechecks/lint and Android export pass 2026-10-02
- [x] Pre-M2 stabilization — SDK 57, rename/icon, 105 tests, Doctor and physical Android success/error/retry pass 2026-10-02
- [x] M2 catalog + ranking — 72 fixtures, deterministic filtering/ranking, rejection/no-match acceptance, 170 tests and Android export pass 2026-10-02
- [x] M3 agent orchestration with mocks — strict tools/state/confirmation boundaries, 6 scenarios/31 turns, HTTP integration, 210 tests, lint/typechecks and Android bundle pass 2026-10-02
- [x] M4 mobile mock experience — 231 tests/lint/typechecks/Android export/Doctor pass; physical Samsung shopping, summary/navigation/cold reload, explicit relaxation confirmation, error/retry and runtime checks pass 2026-10-02
- [x] M5 PostgreSQL persistence/auth/S3-compatible storage — 256 tests, lint/typechecks, local PostgreSQL/S3 integration, Android export/secret scan/Doctor and rebuilt physical-device persistence/error recovery pass 2026-10-02; see `VALIDATION.md`
- [x] Post-M5 keyboard stabilization — 256 tests/lint/typechecks/Android export and physical Samsung keyboard/scroll/send/cold-launch/error-retry checks pass 2026-10-02
- [x] M6 YouCam integration — mock-first scope: 281 tests/lint/typechecks, Android export/secret scan/Doctor/native build, physical upload/job/cold-restore/keyboard pass 2026-10-02; live account/assets/rendering remain unverified (see `YOUCAM.md`)
- [x] M7 live LLM integration — complete 2026-10-04: bounded live/tool and physical checks pass, 315 tests/export pass, final 29 requests/$0.1106142; M8 stopped, deferred live YouCam gate remains open
- [ ] Final-submission live YouCam gate — approved account/credits/assets, real rendering and optional analysis evidence; mock validation never closes this gate (see `YOUCAM.md`)
- [x] M8 cross-product intelligence — complete 2026-10-04: selected-anchor search, relevant feedback and comparison pass; 345 tests and physical Samsung checks; mock-only, deferred live YouCam gate OPEN
- [ ] M9 polish/submission

Before marking a box, satisfy every acceptance criterion in `MILESTONES.md` and run the relevant regression scenarios.

- [x] Post-M8 catalog-image stabilization — 72 original local illustrations; 433 tests, Android export and Samsung checks passed. No live credits; M9 not started.

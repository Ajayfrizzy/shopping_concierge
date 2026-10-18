# Submission notes

**Current status — 2026-10-18:** signed standalone Android code 6 and hosted production API exist. Final acceptance/recording is **NO-GO** pending accessible genuine output, recording-plan review and judge APK distribution. See [current audit](FINAL_PRODUCTION_ACCEPTANCE.md) and [proposed 150-second script](FINAL_DEMO_PLAN.md). Historical milestone statements below do not describe current deployment or budget status.

**Project:** Shopping Concierge — a stateful accessory purchasing-decision agent.

**Pitch:** Describe a goal, refine without losing constraints, learn from structured rejection reasons, coordinate a selected accessory with another category, and consult visual evidence only when useful. The system exposes actual state changes and honest no-match results.

**Implemented:** earrings, necklaces, rings and watches; 72 synthetic catalog fixtures; scoped hard/soft constraints; save/shortlist/select/reject; reason-aware ranking; selected-anchor complement dependencies; criteria-grounded comparison; persistent guest sessions; owned image upload and VTO jobs; explicit relaxation confirmation. OpenAI planning and four YouCam VTO categories have separately passed live validation. M9's repeatable demo remains mock-only.

**Architecture:** Expo/React Native presentation → Fastify authentication/orchestration → validated agent plans → deterministic decision engine/catalog → portable PostgreSQL/S3 adapters. YouCam/OpenAI credentials and provider shapes stay behind server adapters. [README](../README.md) and [architecture](ARCHITECTURE.md) describe the boundaries.

**Artifacts:** [setup/access](DEMO_SETUP.md), [judge guide and API use](JUDGE_GUIDE.md), [1–3 minute script](DEMO_SCRIPT.md), [validation record](VALIDATION.md), and [milestone tracking](MILESTONES.md).

**Claims and limitations:** synthetic inventory, not a merchant integration; no purchase/checkout; bounded language authorization; optional email API disabled; optional live visual analysis unvalidated; signed VTO outputs expire; mocks generate no rendered image. The local mock development APK needs a host running Metro/API; the separate standalone production APK uses the deployed RumptyCloud HTTPS backend. A judge download link is still pending. Device validation is Android-first, not an iOS certification.

**Credits:** existing M7 usage 29 requests / approximately $0.1106142; deferred live YouCam gate 5 renders / 5 observed units, including one necklace framing retry. Gate usage included zero OpenAI calls. `npm run credits:report` reads historical counters locally; it does not consume credits. M9 must not reset these ledgers or repeat completed renders.

**Before external submission (manual):** record/review the final timed video, confirm the hackathon portal's required fields and deliverable format, re-review any newly added imagery under the no-personal-photo rule, and supply any required repository/video links. No portal submission, public upload, email, cloud deployment or new live call has been performed or authorized by these notes. Do not mark external submission complete based solely on local documentation.

**Current M9 readiness (2026-10-07):** complete for local milestone acceptance. 455 tests, clean install, 20/20 Expo Doctor, native build/fresh Samsung installation and physical regressions pass. A continuous **106.01-second** [device rehearsal](evidence/m9/timed-demo.mp4) includes clearly labeled historical live evidence and consumes zero credits. Original phone data is preserved. Dependency advisories remain documented. Final narration/publication/portal review and any external submission or deployment are separate, unperformed tasks.

## Public repository review — 2026-10-07

The subsequent documentation cleanup passes a fresh locked install, lint/typechecks, all 458 tests and Android export. See [repository audit](REPOSITORY_AUDIT.md) for file disposition and the current dependency advisory report. The 2026-10-08 publication review resolves the earlier photo/history decisions: both visible portraits are owner-confirmed synthetic, no recognizable personal photo was identified, and existing history is retained by explicit instruction. No external submission or deployment has occurred.

## Publication readiness — 2026-10-08

The repository is ready for public push with documented residual advisories: 0 critical, 19 high and 10 moderate. A compatible concurrently/shell-quote patch resolves both prior critical entries. Fresh install, lint/typechecks, 458 tests, Android export, 20/20 Expo Doctor and secret scans pass. See [repository audit](REPOSITORY_AUDIT.md) and [image provenance](evidence/IMAGE_PROVENANCE.md). No push, deployment or external submission has been performed.

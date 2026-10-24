# Final Devpost submission — Shopping Concierge

Prepared October 24, 2026. Copy the sections below into the matching Devpost fields. The owner has reviewed and published the final narrated demonstration. This document does not submit an entry or certify organizer eligibility.

## Project title

Shopping Concierge

## Tagline

An accessory shopping assistant that remembers your preferences, coordinates your choices, and brings YouCam visual evidence into the decision.

## Inspiration: the problem

Choosing accessories online means juggling budget, material, style and whether pieces work together. A shopper may reject one pair of earrings as too flashy, choose another, and then search for a necklace. Those decisions should carry forward instead of being lost in a new search or buried in a conversation.

We built Shopping Concierge to make that journey coherent: a conversation supported by explicit shopping state, grounded product comparisons and visual evidence when it helps.

## What it does

Shopping Concierge helps shoppers explore earrings, necklaces, rings and watches. A natural-language request becomes explicit shopping constraints. The app shows matching catalog items, lets the shopper save, shortlist, select or reject them, and records structured rejection reasons.

Selecting an item can anchor a related search in another category. A necklace search can therefore complement chosen earrings while retaining the silver preference and applying its own budget. Comparisons use actual catalog prices, materials, styles and the shopper's criteria. If hard constraints produce no exact matches, the app proposes an adjustment for explicit confirmation rather than silently relaxing them.

Eligible products support YouCam-powered virtual try-on. The shopper can inspect a completed result, compare it with the original image and zoom. A session summary brings the saved preferences, decisions and product relationships together.

## Key features and demo journey

- Ask for silver earrings under 120 US dollars using natural language.
- Reject Gala Earrings as too flashy using a structured reason.
- Select Quiet Round Earrings at 35 US dollars and preserve that choice.
- Inspect a genuine previously completed YouCam result, switch between Original and Virtual try-on, and zoom to inspect the preview.
- Ask for a necklace under 100 US dollars that works with the selected earrings.
- Compare N01 and N02 using catalog facts and saved preferences.
- Reopen the summary to see selected/rejected products and the explicit necklace dependency.

The demo uses 72 illustrative catalog items with synthetic prices and availability, not a live merchant inventory. The YouCam result is genuine, viewed on Android during the recording. The video includes disclosed edits and later close-ups from the same session. It retains an initial summary-details loading failure before showing a successful later reopen. The rejection reason is evidenced in the original rejection interaction, not displayed in the summary itself.

## How we use YouCam

YouCam accessory virtual try-on is integrated through a server-side REST adapter. The backend checks product eligibility, session ownership and input-image requirements before provider work. It persists job identity and submission claims, checks spending limits, and tracks reservations so network uncertainty does not silently start another paid render.

Existing provider tasks can be checked through an explicit authenticated recovery action. Output retrieval validates trusted signed access, image signatures and decoding, size and dimensions, and expiry. Android displays the genuine completed result alongside an authenticated Original image. Viewing, switching and zooming do not submit another render.

Earrings, necklaces, rings and watches passed a separate live validation gate. The final demonstration focuses on E01 earrings. Optional live visual analysis is not claimed as implemented/validated. Virtual try-on is a visual aid; it does not guarantee physical fit or exact product fidelity. Signed results expire, and digital zoom cannot add image detail.

## How we built it

The mobile app uses React Native, Expo Router and TypeScript. A Fastify API handles authentication, shopping orchestration, uploads and visual jobs. Zod contracts validate boundaries across the monorepo.

An OpenAI adapter proposes bounded structured actions. Deterministic services validate those actions and own shopping truth: catalog facts, hard constraints, ranking, feedback and cross-category dependencies. Chat history provides context but is not the sole store of a shopper's choices.

PostgreSQL persists sessions, events, jobs and accounting. Private inputs use S3-compatible object storage. The production backend runs on RumptyCloud through portable adapters. Provider credentials remain server-side. Android uses a guest identity; no shared judge login or provider API key is required.

Built with: TypeScript, React Native, Expo, Expo Router, Node.js, Fastify, Zod, PostgreSQL, S3-compatible storage, OpenAI Responses API, YouCam virtual try-on API, RumptyCloud, Vitest and Android.

## Challenges we encountered

Maintaining preferences across conversational refinements required separating AI proposals from deterministic state transitions. We made scoped constraints and product relationships explicit, so changing a necklace budget does not discard unrelated preferences.

Network uncertainty around paid image tasks required durable request identities, persisted submission claims, ledger checks and conservative handling of unknown outcomes. We added explicit queued-job consent and same-task result recovery rather than silently replaying provider submissions.

A completed YouCam PNG arrived with a generic binary content type. We corrected validation to accept that response only when the trusted URL, image signature, full decode and existing integrity checks all passed.

On Android, switching from an authenticated original photo to a signed result exposed retained native image headers. The v11 viewer isolates image identities and supplies explicit result headers, preserving authentication boundaries and reliable switching. Genuine output expiry remains visible rather than triggering a replacement render.

The demo also captured a temporary summary product-details loading failure. A later read-only reopen displayed the saved information. We disclose both; we have not established or claimed a specific fix for that earlier lookup failure.

## Accomplishments we are proud of

We delivered a standalone signed Android beta and a published 150-second demonstration that connects conversational search, remembered feedback, product selection, cross-category coordination, factual comparison and genuine YouCam output.

The accepted Android v11 verification recorded 983 passing integration-enabled tests and Samsung viewer acceptance. The released artifact is the same verified signed APK, not a new untested build. These are dated engineering checks, not claims of customer adoption or measured shopping outcomes.

Our contribution is the combined decision workflow: preferences, product relationships and visual evidence support the same shopping session.

## What we learned

Reliable AI shopping experiences need explicit state and authorization boundaries. A useful language model can suggest an action, but deterministic services must protect product facts, budgets and user decisions.

We also learned that asynchronous image workflows need careful handling of authentication, expiry, uncertain network responses and paid submission consent. Real device testing exposed behavior that mock responses alone could not establish. Truthful demonstrations should show limitations and distinguish later recovery evidence from a flawless uninterrupted take.

## What's next

We plan to explore authorized merchant catalog integrations, broader device accessibility and usability testing, and clearer result-retention and expiry experiences. We also want to evaluate recommendation quality with consenting users and improve category-specific image guidance.

These are future plans. The current beta does not offer retailer integration, checkout, guaranteed fit or measured consumer outcomes.

## Public links

- Repository: https://github.com/Ajayfrizzy/shopping_concierge
- Android v11 APK: https://github.com/Ajayfrizzy/shopping_concierge/releases/download/v0.1.0-android/shopping-concierge-0.1.0-v11-arm64-release.apk
- Release notes/checksum: https://github.com/Ajayfrizzy/shopping_concierge/releases/tag/v0.1.0-android
- Official YouTube demo: https://youtube.com/shorts/8SNE4YJEOBI?feature=share
- Alternate watch URL for a portal that expects a standard video link: https://www.youtube.com/watch?v=8SNE4YJEOBI (same video ID; verify portal preview).

## Judge installation notes

Requires an ARM64 Android phone running Android 7.0/API 24 or later and internet access to the live backend. Download and open the APK; allow installation from the trusted browser/file manager if Android asks. No Expo Go, Metro, shared account or provider keys are required. Existing installations with the same certificate update in place; do not clear saved app data to bypass a signing conflict.

Version 0.1.0, Android code 11, package `com.youcam.shoppingconcierge`.

APK SHA-256: `82f7efad6957d71a3778d127140d23009b6d9081b2675ec9c8ab8d63ec7f9ed0`.

A new guest installation does not inherit the private demonstration session or its completed image. The published video preserves genuine captured output; signed live access expires. Provider availability and authorized budget limits govern new operations. Watching the video requires no paid operation.

## Owner confirmation before submission

Official event: https://youcam-api-skin-ai-ecommerce.devpost.com/ (provided by the owner). Automated unauthenticated requests to the event, rules and details pages returned HTTP 403 on October 24, 2026, so current published rules could not be independently read. The earlier owner brief records November 2, 2026 and a 1–3-minute video requirement; these are not a fresh rules verification. The 150-second video fits that stated range. Confirm the official deadline, timezone, judging criteria, required APIs/categories, language, video visibility/embed rules, APK/repository access and mandatory fields in your browser.

The owner must supply/confirm:

- Exact event and challenge/track; eligibility, geography, age and team-size requirements.
- Team names, roles, contact information and affiliations.
- Originality, prior-work dates, permitted pre-existing work and AI/tool-use disclosures.
- Ownership/permission for source code, catalog illustrations, synthetic portrait, narration and video; required third-party notices.
- Any required terms, consent, prize/tax declarations and sponsor-specific checkboxes.
- Project logo, screenshots or cover image if mandatory, using reviewed actual assets only.
- Playback and embedded preview of the published video, all pasted links and final submission receipt.

Do not infer any of these declarations from repository access. No Devpost entry has been submitted by this preparation task.

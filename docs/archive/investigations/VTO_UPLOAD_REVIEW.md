> Historical record, archived 2026-10-19. Test counts, deployment failures, pending gates and budgets below describe their original observation dates, not current status. See [final acceptance](../acceptance/FINAL_PRODUCTION_ACCEPTANCE.md) for the code-6 / 836-test baseline and dated budget snapshot. Original findings are retained; later acceptance does not erase earlier failures.

# E12 chandelier replacement approved — 2026-10-10

The user explicitly approved a new design for E12, superseding the earlier identity rejection. E12 now uses the silver single chandelier at `vto-products/earrings/e12-evening-vto-v3-single-f19910.png` under the existing project prefix; SHA-256 `fc85563834e740cfa65732d07f1a360a1a6768a395013885299f4b621daa3a8c`, PNG 1254×1254. Production registration and description were updated transactionally; eligibility remains true, all other product fields/registrations unchanged. There are still 72 products and 12 eligible products.

**Demo-approved on the tested synthetic portrait.** The one authorized new render completed, was retrieved/displayed, and shows a single upright chandelier attached near the lobe, with branching and dangling components visible. Scale is materially improved over the old E12 pair and broadly comparable in drop length to the historical E03 successful screenshot. Fine detail is limited by the 300×375 result; this is not a physical-size guarantee or new on-device validation.

One new committed request/unit, no duplicate accounting; judge usage **6/50**, **44 remaining**. A pre-submission database/check interruption consumed no render; resuming only followed confirmation of no job/submission and unchanged baseline. OpenAI remains mock and unused. Final readiness HTTP 200 ready.

Separate E12 catalog display PNG/SVG and its approved local source were updated, and regeneration preserves them. Existing installed apps need a later mobile build to show this bundled artwork; no APK or automatic deployment was performed. Price/style/ranking fields remain unchanged. The private VTO image is not used as a public catalog URL.

Storage cleanup: these old keys under `vto-products/earrings/` are no longer registered: `e12-evening-vto-v1-71a2f4.png` and `e12-evening-vto-v2-tight-pair-cbff6f35187b.png`. Production reference audit found only completed historical jobs. They are not required for current renders or terminal-job reads; the old source bytes/hashes are archived locally in reviewed evidence. The user may delete these two old bucket objects. **Keep `e12-evening-vto-v1-aa1d5a.png`: it belongs to E01. Keep v3-single-f19910.** No object was deleted by this task.

162 tests across four relevant catalog/image/manifest/eligibility files passed; lint, typechecks, API build and Android export secret scan (95 files, 7 sentinels) passed. Evidence: [summary](../../evidence/e12-chandelier/summary.json), [live result](../../evidence/e12-chandelier/result.png), [registration](../../evidence/e12-chandelier/activation.json), [reference audit](../../evidence/e12-chandelier/reference-audit.json). All earlier E12 exclusion/identity-failure notes below apply to the previous design and are superseded by this explicit replacement approval and live result.

---

# E12 v3 single-earring upload review — 2026-10-10

**Offline review failed: product identity mismatch. No v3 registration or live render.** The actual suffixed object was discovered by listing the private earrings prefix and read with backend S3 credentials. It reports image/png, fully decodes at 1254×1254, and shows one complete silver-colored earring on white without visible text, model, props or decorative frame. However, it changes the approved product: v1/v2 is a stone-set hoop with one teardrop pendant; v3 is a marquise-top branching chandelier with multiple drops. Shared color/category is insufficient to establish identity.

Exact candidate key: `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/earrings/e12-evening-vto-v3-single-f19910.png`.

SHA-256: `fc85563834e740cfa65732d07f1a360a1a6768a395013885299f4b621daa3a8c`.

E12 remains registered to v2 with unchanged eligibility. V1/v2 objects and historical evidence were preserved. The manifest references the rejected candidate evidence without replacing its approved key/hash. A valid replacement must isolate one complete earring from the approved E12 pair, preserving the hoop, connector and single teardrop, rather than redesigning it.

Comparison: E12 v2 remains materially too small with indistinct dangling detail. The historical E03 successful screenshot shows a clear vertical gold earring attached at the lobe with its round pendant visible below. V3 has no live result because its identity gate failed; no claims about its live scale, placement or fidelity are made. **Final recommendation: exclude E12 from the faithful final-demo showcase in its current state.** No further variant generated or tested, OpenAI use, APK or demo-script creation.

Evidence: [candidate review](../../evidence/e12-v3-review/candidate.json). Additional renders consumed: **0**. Read-only audit confirms 5 committed judge renders total, **45/50 remaining**, E12 still eligible on v2, and HTTP 200 ready with mock OpenAI. Manifest/eligibility regression: **12 tests passed**. See `../../evidence/e12-v3-review/audit.json`.

---

# E12 fidelity investigation — 2026-10-10

**E12 is not acceptable as a faithful statement-earring demo example.** One authorized tighter-framing follow-up completed successfully but produced no material visual improvement. No further renders were attempted. E12 remains technically registered/eligible; fidelity approval is explicitly withheld. All other product registrations and provider settings were preserved.

Offline source measurements: E03 original pair canvas 360×395, approximate product bounds 223×292 (61.9% width / 73.9% height), gap 24 px (6.7% width). E12 original canvas 1254×1254, bounds 822×932 (65.6% / 74.3%), gap 117 px (9.3%). E12 is a silver hanging teardrop design, not inherently a stud; physical dimensions are unknown. E03's historically successful live reference was a 123×327 single-front-earring crop, so comparing its success with a full-pair E12 reference is confounded. Whitespace alone was not the leading explanation; provider pair interpretation/scaling was suspected before mutation.

A single lossless crop removed E12's faint outside frame and unnecessary margins while preserving all product pixels, proportions, finish and pair spacing. New canvas 862×972; the same bounds occupy 95.4% width / 95.9% height. Both complete earrings remain visible and separated on the original white background. No design generation/substitution or original-object overwrite occurred. New object and SHA-256: [replacement record](../../evidence/e12-fidelity/replacement.json); this record retains the full previous manifest entry/hash/evidence.

The same approved side-profile input was reused. Both old and new results put a tiny ornament at the lobe, approximately 8–12 pixels high versus an approximately 65–75-pixel ear. Placement is near the lobe and broadly upright, but full pendant/hoop identity is not discernible; the defect is scale plus fidelity, not output-frame clipping. Only 140 of 337,500 RGB channel values differ between results (mean absolute difference 0.00106/255). This strongly suggests remaining provider/category pair interpretation or scaling, rather than outer canvas whitespace, without proving the provider's internal cause.

**Additional consumption: 1 render; judge total 5/50, 45 remaining.** Exactly one new committed reservation; duplicate queue/terminal replay checks passed without additional usage. OpenAI remained mocked and unused. Final readiness HTTP 200 / ready. Historical validation accounting remains separate. Twelve manifest/eligibility tests pass; lint and typechecks pass. No APK or demo script created.

[Diagnosis recorded before changes](../../evidence/e12-fidelity/DIAGNOSIS.md), [comparison](../../evidence/e12-fidelity/output-comparison.json), [summary](../../evidence/e12-fidelity/summary.json), [new output](../../evidence/e12-fidelity/result-v2.png). Earlier 46-remaining and initial E12-key references below are historical and superseded only for E12 by this investigation.

---

> Production registration completed 2026-10-10: exactly E01/E03/E12, N01/N03/N12, R01/R03/R08 and W03/W08/W11 are registered and eligible; the other 60 products remain ineligible. All recorded asset identities/hashes are preserved. Registration evidence: [judge registration](../../evidence/vto-uploads/judge-registration-2026-10-10.json). Controlled live verification is recorded separately in ../milestones/VALIDATION.md. Earlier pending-upload/registration notes below are historical.

# Final N12 framing recheck — 2026-10-10

The new N12 object passes offline appearance review: complete silver-colored statement necklace, chain, clasp and pendant with white margins and no visible presentation border. Backend credentials successfully read all five necklace objects; selected image reports image/png and decodes to PNG 1319×1192. Square framing is a preparation recommendation, not a verified mandatory endpoint limit. Historical N03 bytes are unchanged.

Exact selected key: `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/necklaces/n12-evening-vto-v1-241860.png`. SHA-256: `62df66d79c57212397d1a6ac551c37bafaa2461b197f32fb6def71537520845d`.

All eight additions now pass offline appearance review. The 12-product asset inventory is present, but the operational 12-product VTO catalog is not yet complete: eight additions remain uploaded/ineligible pending approval and registration; no live output has been tested for these additions. Compatible backend/schema readiness must be checked before production registration. No deployment, database writes, provider calls or budget activation occurred. Prior inspections below are historical and superseded for N12. Evidence: `../../evidence/vto-uploads/n12-final-2026-10-10.json`.

---

# Replacement review — 2026-10-10

Four replacements were discovered by listing the actual private category prefixes. All four are readable image/png objects, decoded PNG 1254×1254; exact keys and hashes are updated in the manifest. Earlier rejected files remain in S3 but are no longer selected. All four historical approved asset hashes remain unchanged.

| Product | New actual filename              | Offline finding       |
| ------- | -------------------------------- | --------------------- |
| E12     | `e12-evening-vto-v1-71a2f4.png`  | Appearance passed     |
| N12     | `n12-evening-vto-v1-41d6a3.png`  | Needs uncropped chain |
| R08     | `r08-square-vto-v1-cb5304.png`   | Appearance passed     |
| W11     | `w11-everyday-vto-v1-43af00.png` | Appearance passed     |

The replacements correct the color mismatches. N12 still needs an uncropped full-chain reference: the new silver necklace exits the top edge of the image. Use wider framing with the complete chain/clasp and white margin; remove the thin presentation border when re-exporting. Other replacements match the intended visible product shape/color; no material-composition or live-output claim is made.

The eight additions remain uploaded/ineligible, with seven now passing product-appearance review and one (N12) pending framing correction. Database registration/deployment remain separate gates; none was performed. Machine-readable evidence: `../../evidence/vto-uploads/replacements-2026-10-10.json`. Previous inspection below is retained as historical evidence and is superseded where replacement findings differ.

---

# Uploaded VTO asset inspection — 2026-10-10

All 12 objects were listed and read through the configured backend S3 credentials: three per category. The eight new objects report image/png, decode as PNG at 1254×1254, and have recorded SHA-256 hashes. The four historical asset hashes still match exactly. No provider requests, bucket writes or production catalog writes occurred.

The eight new entries remain **uploaded**, not validated/registered. Eligibility remains false (current database legacy records omit vtoEligible, interpreted as false). The database has migrations 1–4 only; migration 006 and a compatible deployed backend are still required before catalog registration. No migration/deployment was attempted in this inspection.

| Intended product | Exact observed object key                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| E01              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/earrings/e12-evening-vto-v1-aa1d5a.png`      |
| E12              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/earrings/e01-quiet-round-vto-v1-f50c17.png`  |
| N01              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/necklaces/n01-quiet-round-vto-v1-848458.png` |
| N12              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/necklaces/n12-evening-vto-v1-ab6469.png`     |
| R01              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/rings/r01-quiet-round-vto-v1-780571.png`     |
| R08              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/rings/r08-square-vto-v1-d0e860.png`          |
| W11              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/watches/w08-square-vto-v1-222e61.png`        |
| W08              | `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/watches/w11-everyday-vto-v1-6510f3.png`      |

## Visual findings

- E01 maps to the **e12** filename: silver round stud pair. Offline appearance check passed.
- E12 maps to the **e01** filename: dangling statement earrings, but gold-colored. Requires a silver replacement matching E12.
- N01: silver chain and restrained round pendant. Offline appearance check passed.
- N12: gold-colored statement necklace. Requires a silver replacement matching N12.
- R01: silver-colored round band with restrained solitaire setting. Offline appearance check passed against the minimal/round brief; no gemstone composition or metal-purity inference is made.
- R08: black square face with prominent silver-colored body/band. Requires a consistently black-finished design matching the black catalog color.
- W11 maps to the **w08** filename: round watch but silver case/pale dial. Requires a small round black-finished design matching W11.
- W08 maps to the **w11** filename: black square watch. Offline appearance check passed; titanium composition cannot be established visually.

Mappings are based on the visible object/category, not the embedded filename ID. Both swapped pairs are explicitly recorded; objects were not renamed or overwritten. No other category/product was substituted to bypass metadata. All new assets are isolated on white backgrounds. New reference render outcomes remain untested; visual review cannot establish physical materials or YouCam output quality.

Machine-readable complete listing, MIME/dimensions, hashes and review evidence: `../../evidence/vto-uploads/inspection-2026-10-10.json`. The manifest now records exact objectKey in addition to actual filename and relative assetPath. Registration rejects a configured prefix different from the inspected full key. Uploaded-only entries remain excluded even when hashes exist.

The intended twelve-product VTO-ready catalog is **not complete**: four assets need corrections, four have passed offline visual checks but await registration validation/compatible backend, and four previously approved assets are preserved. Do not activate new eligibility or judge budgets based on file upload alone.

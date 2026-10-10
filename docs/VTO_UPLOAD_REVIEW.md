# Final N12 framing recheck — 2026-10-10

The new N12 object passes offline appearance review: complete silver-colored statement necklace, chain, clasp and pendant with white margins and no visible presentation border. Backend credentials successfully read all five necklace objects; selected image reports image/png and decodes to PNG 1319×1192. Square framing is a preparation recommendation, not a verified mandatory endpoint limit. Historical N03 bytes are unchanged.

Exact selected key: `projects/01a0f9c5-53d5-7eab-b357-9dd0f0db15f3/shopping-concierge/vto-products/necklaces/n12-evening-vto-v1-241860.png`. SHA-256: `62df66d79c57212397d1a6ac551c37bafaa2461b197f32fb6def71537520845d`.

All eight additions now pass offline appearance review. The 12-product asset inventory is present, but the operational 12-product VTO catalog is not yet complete: eight additions remain uploaded/ineligible pending approval and registration; no live output has been tested for these additions. Compatible backend/schema readiness must be checked before production registration. No deployment, database writes, provider calls or budget activation occurred. Prior inspections below are historical and superseded for N12. Evidence: `evidence/vto-uploads/n12-final-2026-10-10.json`.

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

The eight additions remain uploaded/ineligible, with seven now passing product-appearance review and one (N12) pending framing correction. Database registration/deployment remain separate gates; none was performed. Machine-readable evidence: `evidence/vto-uploads/replacements-2026-10-10.json`. Previous inspection below is retained as historical evidence and is superseded where replacement findings differ.

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

Machine-readable complete listing, MIME/dimensions, hashes and review evidence: `evidence/vto-uploads/inspection-2026-10-10.json`. The manifest now records exact objectKey in addition to actual filename and relative assetPath. Registration rejects a configured prefix different from the inspected full key. Uploaded-only entries remain excluded even when hashes exist.

The intended twelve-product VTO-ready catalog is **not complete**: four assets need corrections, four have passed offline visual checks but await registration validation/compatible backend, and four previously approved assets are preserved. Do not activate new eligibility or judge budgets based on file upload alone.

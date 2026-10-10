> Latest N12 recheck (2026-10-10): the new `n12-evening-vto-v1-241860.png` passes offline appearance review with complete chain/clasp and pendant. All eight additions now pass offline appearance review and remain uploaded/ineligible pending approval and registration. Live rendering remains untested. See [VTO upload review](VTO_UPLOAD_REVIEW.md).

# Curated judge VTO assets

The selection is complete: 12 existing catalog products, three per category. Current asset inventory is **4 historically validated + 8 uploaded**, with all eight additions passing offline appearance review. New assets remain unregistered and ineligible. The table below records original planned filenames; actual suffixed keys are in the manifest and latest upload evidence. The full 72-product catalog, display images, prices and ranking remain unchanged.

`fixtures/vto/judge-assets.json` is the registration manifest. Every entry records ID, category, exact catalog name, filename, relative object path, status, hash/evidence and product-specific requirements. Full S3 key = the existing **S3_ASSET_PREFIX + assetPath** (prefix ends in `/`; do not add an extra separator). This uses the existing private bucket; it is not a public URL. Never substitute a decorative catalog image.

| ID  | Exact catalog name            | Fixture USD | Proposed filename          | Relative S3 object key                            |
| --- | ----------------------------- | ----------: | -------------------------- | ------------------------------------------------- |
| E01 | Fixture Quiet Round Earrings  |          35 | e01-quiet-round-vto-v1.png | vto-products/earrings/e01-quiet-round-vto-v1.png  |
| E12 | Fixture Evening Earrings      |         180 | e12-evening-vto-v1.png     | vto-products/earrings/e12-evening-vto-v1.png      |
| N01 | Fixture Quiet Round Necklaces |          50 | n01-quiet-round-vto-v1.png | vto-products/necklaces/n01-quiet-round-vto-v1.png |
| N12 | Fixture Evening Necklaces     |         195 | n12-evening-vto-v1.png     | vto-products/necklaces/n12-evening-vto-v1.png     |
| R01 | Fixture Quiet Round Rings     |          45 | r01-quiet-round-vto-v1.png | vto-products/rings/r01-quiet-round-vto-v1.png     |
| R08 | Fixture Square Rings          |         150 | r08-square-vto-v1.png      | vto-products/rings/r08-square-vto-v1.png          |
| W11 | Fixture Everyday Watches      |          90 | w11-everyday-vto-v1.png    | vto-products/watches/w11-everyday-vto-v1.png      |
| W08 | Fixture Square Watches        |         205 | w08-square-vto-v1.png      | vto-products/watches/w08-square-vto-v1.png        |

Prices above are existing synthetic fixture metadata, not merchant offers. Silver minimal E01/N01/R01 support cheaper, work/everyday and coordinated silver flows. Silver statement E12/N12 support party/wedding and too-large/too-flashy rejection flows. R08/W08 add black titanium square designs and higher prices. W11 adds a cheaper small round black steel watch. These contrast with the existing E03/N03/R03/W03 references without altering search semantics. The earlier 04/13 placeholders are superseded.

## Asset briefs

- **E01:** small silver round minimal earrings, complete matching pair; no dangling ornament. **E12:** large silver statement dangling pair, entire hanging components visible and separated.
- **N01:** small restrained round silver design, full chain and focal element. **N12:** large silver statement evening design, full chain and focal ornament. Do not add rose-gold/gold details that conflict with metadata.
- **R01:** small round minimal silver ring/band. **R08:** black titanium square-faced ring, balanced proportions. For both, show band opening and complete setting in one coherent three-quarter product view.
- **W11:** small round black steel watch with a minimal dial. **W08:** balanced black titanium square-case watch. Show the full strap/bracelet, case edges and readable face; no wrist/mannequin, brand invention or cropped band.

For these synthetic fixtures, the briefs constrain new imagery to existing material/color/style metadata; they do not assert unrecorded stone composition, dimensions or manufacturing details. Keep the eventual VTO asset visually consistent with the catalog display image during human review. Do not change display images as part of this task.

## Validated endpoint contract versus preparation guidance

All four operations submit one approved product reference URL in `ref_file_urls` to `POST /s2s/v2.0/task/2d-vto/{earring|necklace|ring|watch}` with the shopper's uploaded `src_file_id`. Reference access uses a fresh server-signed HTTPS GET URL whose exact hostname is in YOUCAM_ASSET_HOSTS. Redirects are refused. The object stays private and should be uploaded with Content-Type `image/png`; do not persist signed URLs in the catalog. Default expiry is 900 seconds, signed immediately before submission. Do not invent masks or anchor coordinates.

Use an isolated sharp product on a clean white background, centered with margin, no text/watermark/props/collage/frame. A **1024×1024 or larger square PNG is our preparation target, not a documented mandatory YouCam reference-image limit**. The previously validated assets use isolated product imagery; no transparency requirement is claimed. Exact provider reference-image minimum/maximum dimensions or byte limits are not established by the stored contract. The app's 4 MiB/16 MP PNG/JPEG cap applies to shopper source uploads, not automatically to these S3 product references.

Category-specific source-image constraints from the validated flow:

- Earrings: portrait with the ear exposed and unobstructed; hair must not hide the placement area.
- Necklaces: front-facing portrait with neck and enough chest for the whole necklace. A prior tight crop clipped the pendant; use wider framing for N12 in particular.
- Rings: hand image with visible, unobstructed fingers; preserve the complete target finger area.
- Watches: wrist source including the hand and all five fingers, following prior validated pose guidance.

These are preparation/placement requirements, not a promise of successful live output for the eight missing assets. No new render has been tested.

## Later upload and registration

1. Generate/source the eight matching isolated assets later; review identity, full outline, material/color/style, rights and display consistency. This task creates no images.
2. Upload each to its manifest key in the existing private bucket. Use immutable versioned filenames; do not overwrite the four approved objects. Mark `uploaded` only after verifying object existence/bytes, and record SHA-256. Uploaded is not approval and is never a registration candidate.
3. After explicit asset review, record review evidence and mark `validated`. Here validated means asset readiness/approval; evidence must distinguish offline visual/byte review from actual live-render validation. Existing four entries retain their historical live evidence. Do not fabricate hashes or review evidence.
4. Run `node --env-file=apps/api/.env --import tsx scripts/prepare-judge-vto.mts` (read-only). It selects only validated entries, checks actual S3 hashes and catalog name/category, and fails before any write if verification fails. Missing/uploaded entries are skipped and listed as pending.
5. Only after a compatible backend is deployed and catalog activation is authorized, run the same command with `--apply`. It transactionally registers validated private asset references and enables only those products. No database/schema redesign is required. Missing/uploaded products stay ineligible, with Try on hidden and ordinary unavailable responses.

This manifest is an operator-reviewed artifact, not a public upload API. Merely editing a status is not proof of approval. Registration verifies actual bytes; human review establishes matching appearance. Historical evidence, budgets and provider modes remain unchanged. Do not deploy or activate live providers/budgets as part of asset preparation.

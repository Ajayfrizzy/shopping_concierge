# Evidence image publication review — 2026-10-08

The owner explicitly permits synthetic/generated YouCam validation imagery and prohibits publishing real recognizable personal photos. In response to the specific provenance question, the owner confirmed on 2026-10-08 that **both the side-profile earrings portrait and the front-facing necklace portrait are synthetic/generated**. This confirmation, not visual appearance alone, establishes their provenance.

## Review and disposition

Reviewed all **163 tracked evidence screenshots** through contact sheets, including gallery-view screenshots and the live output/restoration pairs. Reviewed the silent `m9/timed-demo.mp4` at one-second intervals (104 sampled frames over 103.847 seconds), including the historical-image viewer segment at approximately 36–42 seconds. The recorded 106.01-second rehearsal timing includes surrounding action/recording overhead and is separate from media duration. No additional historical image versions were found among reachable Git objects. None of the 163 screenshots contains EXIF, XMP or IPTC metadata.

| Evidence | Decision and basis |
| --- | --- |
| `youcam-live/earrings-result.png`, `earrings-cold-restored.png`, `recovery-restored.png` | Retain: YouCam output using the owner-confirmed synthetic side portrait. |
| `youcam-live/necklace-result.png`, `necklace-cold-restored.png`, `necklace-retry-passed.png` | Retain: YouCam output using the owner-confirmed synthetic frontal portrait. |
| `m9/prior-live-labeled.png`, `historical-live-viewer.png`, `timed-historical-live-evidence.png`, historical segment of `timed-demo.mp4` | Retain: copies/views of the same synthetic earrings evidence, explicitly historical rather than a new mock rendering. The visible gallery thumbnail is that same portrait. |
| Ring/watch output and restoration captures | Retain: hand/wrist-only accessory views; no face or identifying mark was visible in review. Do not infer or claim synthetic provenance for these inputs from their appearance. |
| Other screenshots | Retain: shopping UI, generated accessory artwork, keyboard/navigation, mock lifecycle and error/recovery evidence. No recognizable real-person photograph was identified. |

**Personal-photo removals, crops, redactions or replacements: none required by this review.** No synthetic replacement was composited into an actual result screenshot; the validated historical output remains intact. This does not authorize future personal-photo captures. Re-review newly added evidence before publication.

The [image inventory](publication-review/image-review.json) records paths, hashes and review classifications. The owner authorized preserving existing Git history, including old non-secret machine identifiers. Current public-facing text remains sanitized. Public repository readiness does not constitute hackathon portal submission or permission to add unrelated personal imagery.

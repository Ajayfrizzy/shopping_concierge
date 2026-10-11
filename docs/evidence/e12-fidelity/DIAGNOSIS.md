# E12 offline diagnosis before any asset or registration change

2026-10-10. No new live render submitted at this stage.

Threshold-based estimates (minimum RGB channel <180, excluding the outer ten pixels; pale edges/shadows introduce uncertainty):

| Measurement | E03 original pair | E12 original pair |
| --- | --- | --- |
| Canvas | 360×395 | 1254×1254 |
| Pair bounds | x66 y61, 223×292 | x193 y177, 822×932 |
| Canvas width/height occupied | 61.9% / 73.9% | 65.6% / 74.3% |
| Pair bounding-box area / canvas area | 45.8% | 48.7% |
| Gap between component bounds | 24 px / 6.7% canvas width | 117 px / 9.3% canvas width |
| Outer margins L/T/R/B | 66 / 61 / 71 / 42 | 193 / 177 / 239 / 145 |

Both designs are upright hanging earrings. E03 shows a front and an angled view; E12 is a mirrored pair with teardrop pendants and silver finish. E12 is not visually a tiny stud design; actual physical sizes cannot be inferred without dimensional metadata. Its wider pendant makes each component broader relative to height than E03. E12's source occupancy is slightly higher than E03's original pair, so excessive whitespace alone is NOT a strong explanation for the drastic live shrinkage. Its pair spacing is moderately wider. A faint outer presentation border is also present.

Critical confounder: docs/evidence/youcam-live/corrected-asset-discovery.json records that the historical successful E03 live gate actually used a 123×327 single-front-earring crop at vto-prepared/live-gate/earring-single.png. It did not establish that the original full-pair reference yields the same result. Provider segmentation/placement/scaling of a pair is the leading explanation, with framing and pair separation possible contributors. There is no verified physical-scale parameter in our validated adapter.

Existing E12 live output is 300×375. The visible ornament occupies roughly 8–12 pixels vertically near an ear roughly 65–75 pixels high (manual image estimate, not an anatomical measurement). It is attached near the lower lobe and generally vertical, but full hoop/connector/teardrop identity cannot be distinguished. This is a fidelity issue as well as a scale issue; the image is not merely clipped at its outer boundary. A second small mark appears beside it, consistent with possible pair interpretation, but this cannot be established at this resolution.

Decision: framing is not proven to be the main cause. Prepare ONE conservative tighter pair-preserving crop as a bounded diagnostic correction: remove the outer frame and unnecessary margins, keep all product pixels/proportions and original pair spacing, and put the pair on clean white canvas. This checks the controllable framing contributor without substituting a design or claiming that cropping will resolve provider scaling. If the sole authorized follow-up remains small, stop and classify remaining scale/segmentation as likely provider/category behavior. No synthetic generation, physical-size claims or changes to other assets.

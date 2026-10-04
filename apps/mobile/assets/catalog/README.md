# Original demo catalog illustrations

All 72 SVG originals and corresponding 512×512 PNGs were authored for this repository using `scripts/generate-catalog-art.mts`. They use original geometric accessory designs, no photographs, retailer assets, brand marks, remote downloads or generative API calls. Distributed under the repository MIT license (see root LICENSE). Run `node --import tsx scripts/generate-catalog-art.mts` to reproduce assets and the Metro manifest.

Each product has its own category-appropriate illustration, with fixture color and motif variations. These are illustrative fictional designs, not photographs, merchandise verification or YouCam output. Product facts remain the catalog's existing synthetic facts. Square framing includes padding; mobile uses contain, never stretch. PNGs are bundled locally so catalog imagery needs no separate network host. SVGs are editable source assets, not loaded by React Native.

`catalog://demo/ID.png` is a logical asset identifier in the existing imageUrl field. Mobile resolves it through the static manifest. Unknown/missing identifiers fall back honestly. Future clients need an equivalent resolver. No VTO asset or result URL is changed; catalog illustrations must never be submitted as approved YouCam product assets.

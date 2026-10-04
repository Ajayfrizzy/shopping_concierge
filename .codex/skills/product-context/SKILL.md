# Skill: Product Context

Use this skill whenever making product/scope decisions.

## Goal

Build a purchasing-decision agent, not a generic AI stylist and not a VTO wrapper.

## Must preserve

- Structured shopping state across turns.
- Real catalog grounding.
- Rejection reasons and decision memory.
- Cross-product context.
- Selective VTO as evidence.
- Transparent state changes.
- Honest no-match behavior.

## MVP scope

Categories: earrings, necklaces, rings, watches.
Future roadmap may include bracelets, bags, hats, shoes, apparel, retailer integrations, checkout, inventory sync, merchant tools, voice, shipping/order tracking.

## Product language

Prefer: "matches your stated criteria" / "fits your current constraints".
Avoid: "perfect for you", "makes you more attractive", unsupported beauty judgments.

## Scope discipline

Before adding a feature, ask whether it improves the core demo path. If not, document it under future roadmap instead of implementing during the MVP.

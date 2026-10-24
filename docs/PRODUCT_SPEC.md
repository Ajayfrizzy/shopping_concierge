# Product Specification

Current implementation: [coverage and limitations](IMPLEMENTATION_COVERAGE.md). Selection does not infer a permanent taste profile. Rejection reasons influence deterministic ranking within the session; VTO is a visual aid, not a fit guarantee. No merchant inventory or checkout is connected.

## Product definition

A stateful purchasing-decision agent that helps shoppers complete accessory-shopping goals. It records selections and structured rejections, preserves explicit constraints, coordinates related products, and invokes visual try-on when visual evidence can reduce uncertainty.

## Core job-to-be-done

"Help me decide what to buy, not merely show me products."

## Primary user

An online shopper who knows some combination of occasion, budget, style, color/material, or category but is uncertain about the final purchase.

## Problem

Online shopping makes discovery easy but decision-making fragmented. Shoppers repeatedly search, filter, compare, revisit, and mentally imagine whether products fit their context. The concierge compresses this into: describe -> shortlist -> verify -> refine -> decide.

## Product promise

Tell the concierge what you are shopping for. It finds suitable items from the synthetic fixture catalog, remembers constraints, learns from feedback, lets you visually verify relevant candidates, and helps narrow the decision conversationally.

## Differentiation

Do not position as a generic AI stylist or basic VTO app. The differentiators are:

- structured persistent shopping state
- hard/soft constraint preservation
- rejection memory with reasons
- cross-product dependencies
- selective VTO as evidence
- transparent state changes
- honest uncertainty/no-match handling

## MVP categories

- Earrings
- Necklaces
- Rings
- Watches

## Core MVP capabilities

1. Conversational shopping intent capture
2. Structured constraints
3. Persistent decision state
4. Search over validated synthetic catalog records
5. Explainable recommendations grounded in data
6. Accept/shortlist/reject/save
7. Rejection reason learning
8. Category switching with scoped constraint preservation
9. Cross-product complement searches
10. Visual-profile schema/cache and mock analysis boundary; live face/color analysis is not supported
11. YouCam VTO
12. Product comparison against user criteria
13. "What changed" state-change UI
14. Session-scoped saved items, preferences and decision history; no learned global user profile

## Explicitly out of hackathon MVP

These belong to future roadmap unless needed for the demo:

- checkout/payments
- merchant onboarding
- retailer dashboards
- live inventory sync
- order/shipping tracking
- autonomous purchasing
- voice assistant
- full wardrobe/social network
- real retailer integrations
- huge catalog/marketplace

## Demo story

1. User: "I need silver earrings for a wedding, elegant but not too loud, under $120."
2. Agent extracts/persists constraints and returns real candidates.
3. User rejects one as too flashy; rejection reason is recorded and reranking occurs.
4. User asks to try on another candidate; portrait requested only if missing; YouCam VTO runs.
5. User selects the earrings.
6. User: "Now find a necklace that works with this under $100."
7. System switches category, preserves relevant constraints, creates a complement dependency, ranks necklaces accordingly.
8. User compares two necklace choices and optionally runs VTO.
9. System explains which choice matches the shopper's stated criteria more closely without making beauty judgments.

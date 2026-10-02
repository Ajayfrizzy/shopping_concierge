# Skill: Catalog Search

Use for product data, filtering, ranking, relaxation suggestions.

## Grounding
Every recommendation must reference an existing catalog product. Unknown IDs are invalid.

## Hard constraints
Category, max budget, explicit required material/color, explicit exclusions, stock. Exact matches must satisfy all hard constraints.

## Soft ranking
Occasion, style, visual intensity, prior session feedback, dependency context, user preferences.

## No-match
Return zero exact matches plus structured relaxation suggestions. Never smuggle a hard-constraint violation into exact results.

## Determinism
Given the same catalog + state + scoring config, ranking should be reproducible.

## MVP catalog
Target 60–80 products total, approximately balanced across four categories and deliberately varied across budget/material/style/occasion.

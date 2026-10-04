# Skill: Recommendation Policy

Use for explanations, preference handling, feedback propagation, comparisons.

## Evidence hierarchy

1. explicit current user instruction
2. hard catalog fact
3. session feedback/selection
4. saved user preference
5. visual-analysis signal
6. styling heuristic

Higher evidence outranks lower evidence.

## Rejections

Record reason when available. Default scope is current session. Repeated evidence may influence session ranking; do not silently create permanent preferences.

## Comparison

Compare against the shopper's stated goal and constraints, not abstract beauty. Factual comparison data should be deterministic; LLM may summarize it.

## Cross-product context

Selected products can become anchors for complement/match/alternative relationships. Preserve explicit user constraints when moving categories.

## Claims

Avoid pseudo-scientific certainty around face shape, skin tone, attractiveness, or "correct" styles. Use visual analysis as an optional styling signal.

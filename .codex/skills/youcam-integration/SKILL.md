# Skill: YouCam Integration

Use for all YouCam provider work.

## Server-only
All YouCam credentials and calls must live in the API/provider layer.

## MVP capabilities
- earrings VTO
- necklace VTO
- ring VTO
- watch VTO
- face/color analysis only when current participant access supports it and it materially improves recommendations

## Image requirements
- earrings/necklace: portrait/upper-body as required by endpoint
- ring: hand
- watch: wrist

## Provider adapter
Normalize auth, request construction, polling, provider status, retries, errors, and output URLs.

## Credit discipline
- mock by default
- cache reusable visual analysis
- do not auto-render every recommendation
- live integration tests are explicitly marked and minimal
- log live provider requests during development

## Failure behavior
A rendering/API failure is never an aesthetic judgment. Return a normalized technical failure and actionable image/retry guidance.

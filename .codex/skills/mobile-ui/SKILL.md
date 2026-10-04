# Skill: Mobile UI

Use for React Native/Expo work.

## Experience

Conversation is the primary interface. Do not force category selection before the user can describe a goal.

## Required UX states

- initial concierge prompt
- chat messages
- product cards
- constraint/state-change chip or panel
- loading
- empty/no-match
- VTO requires image
- VTO processing
- VTO success
- VTO failure
- comparison
- saved/selected state

## Image UX

Ask for portrait/hand/wrist only when the active operation requires it. Never front-load all image permissions/uploads.

## Reliability

Typed actions and quick actions must hit the same backend semantics. UI must render server-normalized state rather than reconstructing product truth locally.

## Demo target

Android first. Keep navigation and actions obvious enough for a judge to understand without onboarding narration.

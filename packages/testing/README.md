# Testing

`MockLLMService` and `MockYouCamService` accept `{ fail, latencyMs }` fixtures. M0 exposes assistant connectivity and visual-service connectivity only; it never fabricates catalog or VTO results. Full planner and VTO lifecycle fixtures arrive with their respective milestones.

Run `npm test` from the repository root. Tests never consume API credits.

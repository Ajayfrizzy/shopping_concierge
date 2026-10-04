# M7 physical mock regression — 2026-10-03

Samsung SM-S908N / Android 16, installed Shopping Concierge SDK57 development app; current Metro on 8082 and portable local PostgreSQL/S3 API on 4000. Both AI providers explicitly mocked. No native/config change; no rebuild needed.

- `01-restored-chat.png`: existing session/chat restored with synthetic-data label.
- `02-keyboard.png`: input bounds [33,872][1047,1052], Send [34,1075][1046,1198], both above the Samsung keyboard. Direct Send of “Show my state” reached the API and returned backend state.
- `03-summary.png`: summary navigation shows persisted scoped constraints and selected/shortlisted/saved/rejected catalog references.
- `04-cold-restored.png`: force-stop/relaunch restores conversation. Database comparison confirms identical full domain state; transport version changes 29 → 30 for the existing refresh action, as expected.
- `05-timeout.png`: local API paused with guaranteed resume cleanup; pending request shows honest connection error and Retry after scrolling the chat viewport.
- `06-recovered.png`: Retry succeeds after API resumes; structured state response and enabled composer.
- `runtime-errors.txt`: app-PID ReactNativeJS/AndroidRuntime error filter; no matching runtime-error lines.

These are mock-device regression observations, not evidence of real OpenAI planning or YouCam rendering. Final M7 live-device/provider acceptance remains pending server-side OpenAI credentials and budgeted validation. Prior M6 image-picker MIME code/upload/job restoration and keyboard layout code are unchanged. Do not close the final-submission live-YouCam gate using this evidence.

# User Flows

## Flow A: initial search

Home -> user types shopping goal -> agent extracts constraints -> catalog search -> product cards -> refinements.

## Flow B: rejection learning

Product shown -> user says "too flashy" -> reject reason stored -> rerank/search -> future explanation may reference rejection.

## Flow C: VTO

User taps/types try-on -> check required image -> request portrait/hand/wrist only if missing -> create queued VTO job -> explicit paid-submission consent -> processing UI -> result or honest failure.

## Flow D: cross-product search

User selects product -> asks for related category -> create dependency -> preserve relevant global constraints -> search target category -> show grounded reasons.

## Flow E: no exact match

Catalog returns zero exact hard-constraint matches -> show concise explanation + relaxation options -> user chooses change -> update only chosen constraint -> rerun search.

Android v11 restores queued jobs without first submission. Known live tasks use an explicit **Check existing YouCam result** action; completed viewing never starts a render. See [YouCam lifecycle](YOUCAM.md).

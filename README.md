# Momentum Companion Demo

A safe working copy for testing the proposed hybrid Momentum architecture **without changing Aba's original repository**.

## What is preserved

`app/` contains an unchanged copy of the current deployed V2 entry point (`index.html`) and its PWA assets from the downloaded `transition-companion` repository.

`docs/original-v2-reference/` contains the named V2 HTML snapshots and test/support files for reference. Do not edit these reference copies.

## What we are adding

The demo will connect Aba's existing Transition Companion work to:

1. **Momentum Passport** — sanitized civilian skills, goals and current direction.
2. **Momentum Backend** — one shared source of truth for Passport + verified opportunities.
3. **Momentum Agent** — ongoing conversation and reasoning in a frontier AI environment.
4. **Proactive App layer** — notifications/reminders that bring the soldier back when something relevant changes.

Target loop:

`Onboarding -> Passport -> AI conversation -> confirmed Passport update -> relevant notification`

## Security boundary for this prototype

Use fictional data only. Do not enter real operational stories, units, locations, dates, names or classified/sensitive military information.

## Important provenance note

The original repository's README says `index.html` is the app served by GitHub Pages. The downloaded repository also contains several named V2 HTML snapshots that are not byte-identical to `index.html`. To avoid silently choosing between Aba's historical variants, this starter uses the repository's deployed `index.html` as the working app and preserves all named V2 snapshots unchanged under `docs/original-v2-reference/`.

## Next implementation step

Add a demo Passport store and the four backend tools, then connect the app and Momentum Agent to the same demo record.

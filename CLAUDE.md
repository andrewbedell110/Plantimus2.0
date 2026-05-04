# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plantimus is a pure static browser companion (no build tools, no npm, no server) designed for a fixed **1024×600 display**. It is hosted on GitHub Pages at `https://andrewbedell110.github.io/Plantimus/` and requires Chrome (Web Speech API).

**Three source files only:** `index.html`, `styles.css`, `app.js` — plus `GIF/` and `PNG/` asset folders.

To deploy: `git add <files> && git commit && git push`. GitHub Pages auto-deploys from `master`.

## Architecture

### Layout
Fixed 1024×600 viewport. Left 60% (`#plant-panel`) is white and holds the plant image. Right 40% (`#right-panel`) shows either `#weather-panel` (default) or `#chat-panel` (during AI interaction). Panels toggle via the `.hidden` CSS class.

### Plant State Machine (`app.js`)
Plant image is driven by two functions:
- `getBaseState()` — returns the correct passive state based on time/weather priority
- `evaluateState()` — called every second and on any state change; applies AI state if active, otherwise calls `getBaseState()`

**Priority (highest → lowest):**
1. `aiState` — `'wave'` | `'idea'` | `'talk'` | `'wilt'` (set during AI interaction)
2. Sleep (`'sleep'`) — MDT hour ≥ 20 or < 7
3. Yawn (`'yawn'`) — MDT hour === 7
4. Weather: `'water'` (rainPop ≥ 0.20) → `'cold'` (temp < 40°F) → `'hot'` (temp > 90°F)
5. Random idle animation — one of `['happy','jump','move_left','move_right','showoff','tilt']`, fires for 5s at a random second each minute, only when `getBaseState() === 'default'`
6. `'default'` — `GIF/plant_breathing.gif` (animated)

All time calculations use `Date.now() - 6 * 3600000` read via `.getUTCHours()` to get MDT (UTC-6) without local timezone interference.

### Speech Recognition Quirks (Chrome)
- **`continuous: true` is broken in Chrome** — mic opens but `onresult` never fires. The workaround is `continuous: false` with an `onend` restart loop (100ms delay).
- `onend` always fires after `onerror`, so restart logic lives exclusively in `onend`. Do not add restart logic to `onerror` — it causes double-restart loops.
- The `aborted` error is expected during normal operation and is silently ignored; only `not-allowed` requires action (re-show the overlay, clear `localStorage`).
- Wake word `localStorage` flag (`plantimus_mic`) allows auto-start on reload without a button tap, since Chrome remembers mic permission per HTTPS origin.
- **Known unresolved bug:** after ~20–30s of silence, a rapid `aborted → restart → aborted` loop can occur. A session ID counter fix was attempted but broke initial mic activation. Approach this bug carefully.

### Wake Word Detection
`startContinuousListening()` uses `maxAlternatives: 3` and checks 20 phonetic variants of "Hey Plantimus" because Chrome transcribes this invented word unpredictably. To add new variants, append `transcript.includes('...')` entries to the `if` block inside `continuousRec.onresult`. New variants are discovered from `[Plantimus] Heard: ...` console output.

### AI Flow (`processQuery`)
Wake word → `aiState='wave'` → capture utterance (`startCapture`) → Gemini API → `aiState='idea'` (1s) → `aiState='talk'` + typewriter → `aiState=null`. Chat panel auto-returns to weather after 15s. Error path: `aiState='wilt'` (2s) → `aiState=null`.

### Gemini API Key
Split into `_gk1 + _gk2 + _gk3` in `app.js` to avoid GitHub secret scanning. Reassembled only inside `sendToGemini()`. Uses `gemini-2.5-flash` model with `x-goog-api-key` header. System instruction sets Plantimus personality.

### Weather
Fetches both `/weather` (current conditions) and `/forecast` (rain probability `pop`) from OpenWeatherMap every 10 minutes. Hardcoded to Sandy, UT. Sunrise/sunset converted from UTC Unix timestamps to MDT strings via `unixToMDT()`.

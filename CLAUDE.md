# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A no-build taxi fare meter web app. Almost all markup, CSS, and JavaScript live in one file, `index.html` — there is no bundler, package manager, framework, or dependency of any kind. The only other app files are `manifest.json`, `icon.svg`, and `sw.js` (a Service Worker), which together make the app installable and usable offline once deployed — see "Offline support" below. `taxi.code-workspace` is just a VS Code workspace pointer to this folder.

There is no git repository, no test suite, and no lint/build tooling. "Running" the app means opening `index.html` directly in a browser (`file://`) or via a local server; there is no CLI build step. The app is also deployed to a github.io URL for phone testing (GPS/Service Worker need a secure context — see below); deployment itself isn't done from this repo/session.

## Development workflow

- Edit `index.html` directly — CSS is in the `<style>` block, JS in the `<script>` block at the bottom.
- To view changes, open the file in a browser. On Windows this can be done with:
  ```
  Start-Process "c:\Users\eric6569\Desktop\taxi\index.html"
  ```
  Do not run this automatically after every edit — the user opens/refreshes the browser themselves when ready to test.
- Geolocation requires a secure context for most browsers (`file://` and `localhost` are allowed exceptions in Chrome). If GPS behavior needs testing under stricter conditions, serve the file over `http://localhost` instead of opening it directly.
- The Service Worker (`sw.js`) does **not** register at all under `file://` (not a secure context for that API) — `navigator.serviceWorker` registration is feature-detected so it just silently no-ops locally. Offline-caching behavior can only be verified on the deployed github.io URL (or over `http://localhost`), not by opening `index.html` directly.
- There are no automated tests. Verify changes manually in the browser, including on a mobile viewport (the layout is mobile-first, `max-width: 400px`).

## Architecture

### State model
All app state is a handful of top-level `let` variables (not a framework/store): `status` (`idle` | `running` | `paused`), `dist`, `elapsed`, `waitTime`, `speed`, `maxSpeed`, `isNight`, `gpsReady`, `muted`, `hist` (in-memory trip history — lost on page refresh, not persisted to localStorage).

Rendering is a single imperative `updateUI()` function that reads state and writes to the DOM directly via the `$(id)` helper (`document.getElementById`). There is no virtual DOM / diffing / reactive binding — every state mutation must be followed by an explicit `updateUI()` call to be reflected on screen.

### GPS lifecycle (page-lifetime, not meter-lifetime)
`navigator.geolocation.watchPosition` is started once via `initGps()` → `startWatch()` at page load (bottom of the script) and runs continuously for the life of the page — it is **not** started/stopped by the start/pause/stop meter buttons. Distance (`dist`) accumulation inside the position callback is gated on `status==='running'`, so GPS keeps reporting position/speed even when the meter is idle or paused, but only accumulates distance while running.

Wait-time (`waitTime`) is deliberately **not** accumulated inside the GPS callback — `watchPosition`'s callback rate is device/browser-dependent (throttled when stationary, bursty when moving) and desyncs from real elapsed seconds. Instead, `waitTime` increments once per tick of the same 1Hz `setInterval` that drives `elapsed` (in `startMeter()`), checking the latest known `speed` against `R.sTh`. The GPS callback only updates the `speed` variable; the timer decides whether that counts as "waiting" each real second.

The "開始計費" (start) button is disabled until the first successful GPS fix sets `gpsReady=true` (see `onStart()` guard and `updateUI()`'s `bs.disabled=!gpsReady`). There is no simulated/fake-GPS fallback mode — if geolocation fails or is unsupported, the start button stays disabled.

`timeout` is set generously (20s, in `startWatch()`'s options) because `enableHighAccuracy:true` forces a real GPS-chip fix, which can legitimately take that long on a cold start without Wi-Fi-assisted positioning (A-GPS) — a short timeout here just produces spurious failures while the OS is still genuinely trying. On a retryable error (any `GeolocationPositionError` except `PERMISSION_DENIED`, code 1), `startWatch()` explicitly `clearWatch()`s and calls itself again after a 3s delay — don't rely on the browser auto-retrying a timed-out `watchPosition` on its own; that behavior is inconsistent across browser/OS location stacks and isn't something to build on.

### Status indicator lights (meter + GPS)
Both the meter status and GPS status are shown purely as a colored dot next to a **fixed** label — neither ever changes its text. Both dots reuse the same base `.status-dot` class (14px circle) plus a state modifier class; a shared `@keyframes pulse` (opacity blink) is used for "in-progress" states, steady color for settled states. No `box-shadow`/glow is used on any dot — it was deliberately removed for a flatter look.

- Meter (`#statusDot`, fixed label "計費", driven by `status` in `updateUI()`): idle = grey/steady (no modifier class), running = green/blinking (`.running`), paused = red/blinking (`.paused`).
- GPS (`#gpsDot`, fixed label "GPS", driven by `setGps(s)`): unsupported/not started = grey/steady (no modifier class), waiting for first fix = yellow/blinking (`.gps-locating`), fix acquired = green/steady (`.gps-ready`), permission denied/timeout = red/steady (`.gps-error`).

If you add another status light later, follow this same pattern (fixed label + modifier class on a shared dot) rather than reintroducing dynamic status text.

### Fare calculation
Pure function `fare()` computes the current fare from state on every `updateUI()` call, based on the rule constants in `R` at the top of the script (`baseFare`, `baseDist`, `dUnit`/`dRate` per-distance increment, `wUnit`/`wRate` per-wait-time increment, `sTh` speed threshold below which waiting time accrues, `nPlus` night surcharge). There's no separate "commit" step — fare is always derived, never stored as authoritative state.

Night surcharge (`isNight`) is not a manual toggle — `computeNight()` is re-evaluated on every `updateUI()` call from the current hour, so a trip that crosses the 23:00/06:00 boundary picks up (or drops) the surcharge automatically mid-trip. When active, the fare panel's label swaps from "應付車資" to "應付車資 - 夜間加成" instead of showing a separate badge.

### Fare tick visual effect
Whenever the fare increases while running (`updateUI()`'s `f>lastFare` check), `playFareEffect(delta)` fires alongside the existing tick sound: a `+N`-style `.fare-popup` span appended into `.lcd-panel`, which animates from the bottom-right corner up toward the top and self-removes on `animationend`. (There used to also be a scale-up "pulse" on `#fareDisplay` itself — that was removed by request, so don't reintroduce it unless asked.) Purely decorative (this meter is for personal/hobby use, not commercial billing), so keep it simple — don't wire real logic to it.

`fareFloatUp`'s `animation-timing-function` is `linear`, not `ease-out` — this was a deliberate fix, not an oversight. A non-linear easing gets reapplied independently to *each* segment between keyframe stops (here: 0%→15%→100%), so `ease-out` caused the popup to decelerate near-to-zero at the 15% mark and then re-accelerate, which read as a visible stutter/hitch. Keep any multi-stop keyframe animation in this file on `linear` (or add enough keyframes that the per-segment easing seam isn't visible) to avoid reintroducing that.

### Trip export
On meter stop (`onReset()`), if `elapsed>0`, the trip is pushed to `hist` (in-memory, rendered in the on-page history list) and also exported as a downloaded `.txt` file via `saveTripFile()` using a Blob + temporary `<a download>` link. Filename format: `TAXI_mmdd-hh-mm.txt`. The Blob content is prefixed with a UTF-8 BOM (`'﻿'`) and declares `charset=utf-8` — this is required for Chinese characters to render correctly when the file is opened in Windows/Chrome; do not remove it.

The report itemizes 里程費用 (distance fee) and 等候時間費用 (wait-time fee) as separate lines alongside 車資 (total fare) — `saveTripFile()` recomputes them from `R` with the same formulas `fare()` uses (`distFee` from `dUnit`/`dRate`, `waitFee` from `wUnit`/`wRate`) rather than having `fare()` return a breakdown. Keep these two derivations in sync with `fare()`'s logic if the rate formula ever changes.

Saving is silent — no confirmation modal after the file downloads. The only confirmation is the earlier "結束本次計費？" prompt in `onReset()`; don't reintroduce a second "已儲存檔案" modal after `saveTripFile()`, that was deliberately removed as redundant.

### Sound effects
All sounds are synthesized at runtime with the Web Audio API (`AudioContext`/`OscillatorNode`/`GainNode`) via the `tone()` helper — there are no audio asset files. Each user action has a distinct note pattern: `playStartSound()`, `playTickSound()` (fare increment), `playPauseSound()`, `playStopSound()`. All routes through `tone()`, which no-ops when the `muted` flag is set, so muting doesn't need to be checked at each call site.

### Screen Wake Lock
`requestWakeLock()`/`releaseWakeLock()` wrap the Screen Wake Lock API and are called from the meter start/pause/stop handlers, gated by the `wakeLockEnabled` toggle. A `visibilitychange` listener re-acquires the lock if the tab regains visibility while the meter is still running (the OS releases wake locks when a tab is backgrounded).

### Confirm/alert dialogs
Native `confirm()`/`alert()` are not used anywhere in this app — they prefix the browser's own origin (e.g. "...github.io says") onto the dialog, which is undesirable here. Use the custom `showModal(message, {cancel:true})` helper instead (Promise-based, resolves `true`/`false`); it renders `#modalOverlay` and is driven by `onReset()` and `clearHistory()`. Keep using this helper for any future blocking confirmation — don't reintroduce `confirm()`/`alert()`.

### Offline support (Service Worker)
`sw.js` exists specifically so a reload while offline doesn't fall through to the browser's own "no internet" error page — the driver may lose signal mid-shift, and the app is deployed to a URL (not opened via `file://`), so an ordinary browser HTTP cache isn't guaranteed to have anything usable at that moment. The registration in `index.html` (bottom of the script, `if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js')}`) is feature-detected and silently no-ops where unsupported or insecure (e.g. `file://`).

`sw.js`'s `fetch` handler is **network-first, falling back to cache**: online, it always tries the network first (so a connected user always gets the latest deploy) and re-populates the cache with whatever it gets back; only on a failed fetch (offline) does it serve the cached copy, falling back further to the cached `index.html` if the exact request was never cached. `install` pre-caches `index.html`/`manifest.json`/`icon.svg`; `activate` deletes any cache whose name doesn't match the current `CACHE_NAME`, so old versions don't pile up.

**`CACHE_NAME` in `sw.js` (currently `taxi-meter-sw-v1`) is `sw.js`'s own version, independent of `.app-version` in `index.html`** — the two are unrelated and don't need to move together. Because the `fetch` handler is network-first, an online user gets the current `index.html` content on every load no matter what `CACHE_NAME` is set to — the fetch handler overwrites whatever's in the (same-named) cache bucket with the fresh response every time, unconditionally. `CACHE_NAME` only needs to change to get the browser to notice and install an updated Service Worker when **`sw.js`'s own `install`/`activate`/`fetch` logic changes** (the browser detects updates by byte-diffing `sw.js` itself) — a plain `index.html` content edit, with `sw.js` untouched, needs no `CACHE_NAME` bump. An offline user only ever gets whatever this specific device last fetched successfully while online; that's a function of connectivity history, not of `CACHE_NAME`.

On the phone, Chrome's "安裝應用程式" (Install app) — not "建立捷徑" (Create shortcut) — is the option that actually uses `manifest.json`: it launches in `display:standalone` (no address bar/tabs, its own icon and app-list entry) and is what exercises the Service Worker's offline path. "Create shortcut" is the generic bookmark-icon fallback available on any site regardless of manifest; it doesn't give the standalone window.

## Conventions from prior work

- The `.app-version` text in the status bar (`index.html` status bar, currently displayed alongside GPS status) is bumped on every behavior/functionality change (not for pure copy/CSS tweaks). Keep this convention going. This is unrelated to `sw.js`'s `CACHE_NAME` — only bump `CACHE_NAME` when `sw.js`'s own logic changes, see "Offline support" above.
- UI text and comments are in Traditional Chinese (Taiwan).

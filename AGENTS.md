# AGENTS.md

KindleClock — a single HTML page showing a clock, opened in the Amazon Kindle's
built-in web browser and left running on the e-ink display.

## Status
Three static files (`index.html`, `style.css`, `app.js`) — no build step, no tests,
no dependencies. Verified on Kindle 7 (Kindle 499) and Kindle 10th gen.

## Run
Two options; the page is self-contained (relative refs only, no network calls,
no `localStorage`), so both behave identically.
- **Copy onto the device (preferred for a bedside clock):** copy the three files
  to `/mnt/us/kindleclock/`, then type `file:///mnt/us/kindleclock/index.html`
  in the Kindle browser address bar. Afterwards the Kindle needs no PC.
- **Serve over the LAN (preferred while editing):** `python -m http.server 8000`,
  then `http://<pc-ip>:8000/`.
- The browser caches hard — append `?v=2` after edits or you will keep seeing the
  old version.

## index.html conventions
- **Three files:** `index.html`, `style.css`, `app.js` (plain `<script src>`, no bundler).
- **Do NOT add `<meta name="viewport">`** — the Kindle browser ignores it entirely. `clientWidth`
  already equals physical/CSS pixels and `devicePixelRatio` is always 1, so there is no DPR math.
- **Default display is Beijing time (UTC+8), NOT the device's local time.** This is deliberate and was
  forced by a device measurement: a Kindle whose system clock reads 13:00 renders `getHours()` as
  05:00 — exactly 8h off. The Kindle hides its timezone from JS (`getHours()` and
  `getTimezoneOffset()` are permanently UTC; `Intl.DateTimeFormat` doesn't exist on WebKit 531), so
  the device clock being "set to Beijing" does NOT reach JavaScript. Do not "simplify" this back to
  `getHours()` — that reintroduces the 8h error. The zone is undecidable in JS, never inferred.
- Timezone params: `?tz=<hours>` for any fixed zone (`?tz=9`, `?tz=-5`), `?tz=local` for the
  JS-visible local time (equals UTC on a Kindle). Fixed-zone path is `epoch + tz*3600000` read with
  `getUTC*`, so it is independent of the device zone.
- **Getter rule (mixing these double-counts the offset):** if you add/subtract an offset, read with
  `getUTC*`; if you don't offset, read with the local getter. There is no single-conversion double
  count in the current code.
- `?ofs=<ms>` adds a fine offset to the epoch in both modes; `?tm=dark` toggles dark mode.
- `?safe=<0.3..1>` overrides the fill factor (default `0.97`). Kindle 7 renders visibly smaller than
  the 10th gen, so `?safe=0.99` is worth trying there; `?safe=1` is the no-margin limit.
- `?debug=1` prints a corner readout of `vp` / `scr` / `cont` / `fs` / `rot`, plus calibration
  graphics: a **red outline on the container** (the layout viewport JS believes in) and a **green
  crosshair on the body** (geometric screen centre). If the red edge does not meet the physical
  screen edge, or the crosshair is off the red centre, the layout viewport and the visible area
  disagree — the one discrepancy JS cannot self-detect on Kindle.
- `?ox=<px>` / `?oy=<px>` translate the container for manual compensation; they override
  `?autochrome`. The `translate(x,y)` is ordered **before** `rotate(deg)` in the transform list, so
  the offset applies in the post-rotation screen frame and one value works for all four angles.
- `?autochrome=1` derives the offset from the device instead: `oy = (screen.height - clientHeight)/2`
  and `ox = -(screen.width - clientWidth)/2`. This exists because the Kindle toolbar is an
  **overlay** (drawn on top of the page rather than squeezing the layout viewport), so the visible
  area is taller than `clientHeight` reports and content centred on the layout viewport reads as
  sitting too high. Off by default — overlay behaviour differs per model, and the 10th gen already
  looked correct without it.
- Kindle 7 measured `vp 600x699 scr 600x699 cont 600x699` — the JS chain is self-consistent, so
  `?autochrome=1` yields `oy=50` there. `ox` stays 0 because the permanent right-hand scrollbar is
  an overlay that does not reduce `clientWidth`; nudge `ox` by hand (roughly -8..-15) if the right
  edge still looks emptier than the left.
- Updates fire on the minute boundary via a **recursive** `setTimeout` (`msToNextMinute()` +
  `tick()`), NOT `setInterval` and NOT `<meta http-equiv="refresh">`. Each callback re-derives the
  delay from the current wall clock, so per-timer imprecision never accumulates (verified: ~0.35s
  constant vs. 3s linear drift after 3h with a 350ms-late timer). The `delay < 150` guard prevents
  firing just before the boundary, which would show the previous minute.

## Tap-to-rotate
`rotDeg` starts at `90` (landscape) and each `click` **subtracts 90°**, cycling
90 -> 0 -> -90 -> 180 -> 90. Sequence in device terms: landscape (default) -> upright
portrait -> 90° CW -> 180° CW -> landscape.

- Bind **only** `click`. On Kindle, `mouse*`/`touch*` are aliases of `click`, so binding
  several of them makes one tap rotate multiple times.
- The container is sized **per rotation angle** by `applyLayout()`, rotated about its own centre.
  Invariant: **the bounding box after rotation must equal the viewport.** A `(cw,ch)` rect becomes
  `(ch,cw)` under ±90° and is unchanged under 0/180°, so:
  - `0° / 180°` -> container = `vp.w x vp.h`
  - `±90°`      -> container = `vp.h x vp.w`

  This is geometrically equivalent to the pre-rotation-feature version (`width:vp.h`,
  `transform-origin:left top`, `rotate(90deg) translateY(-100%)`) but holds for all four angles.
- The swapped container is centred with **`left`/`top`, never a `translate`**. With
  `transform-origin: 50% 50%`, `translate(...) rotate(...)` displaces the box by an extra
  container long/short-side difference (measured 57px) because the origin sits at the *pre*-translate
  centre.
- `spaceForOrientation()` reads the container's own `offsetWidth`/`offsetHeight`: text always runs
  along the container's **local x axis**, so `len = offsetWidth` and `cross = offsetHeight` with
  **no** extra `upright` swap — the container sizing above already made the long axis local-x.
  Swapping again there silently shrinks the font.

## Layout: viewport-driven, not model-specific
There are **no hardcoded pixel dimensions**; every size comes from `measureViewport()`. The
`style.css` `100%` on `.container` is only a no-JS fallback — `applyLayout()` overwrites it.

- Rotation maps the element's local **x axis -> screen vertical** (at ±90°) and local **y axis ->
  screen horizontal**. The text is laid out along the container's local x axis.
- **CRITICAL — width/height are SWAPPED at ±90°.** See the rotation-invariant rule above; getting
  this wrong still renders upright but caps the clock at ~82% of the screen.
- Do **not** move the rotation onto `.clock` to "fix" the fill. A single `rotate(-90deg)` on
  `.clock` flips the glyphs upside down (net rotation becomes -90°, verified in a screenshot).
  The rotation belongs on `.container`; `.clock` only does `translate(-50%,-50%)`.
- `fit()` clamps font size by BOTH axes: `len` (fill target) and `cross` (hard cap), both from the
  container's own dimensions.
- **Separator dots must not use percentage `left`.** `.sep` needs a real `height` (not `0`) to be a
  resolvable containing block; old WebKit degrades `left:50%` against a zero-height box and throws
  the dots to the far left. Use absolute `em` offsets (`left:0.07em`, `top:0.16em/0.44em`).
- `SAFE = 0.97` trims the browser UI (address bar/toolbar) + a safety margin. Matches the measured
  Paperwhite 3 ratio (1231 usable / 1268 viewport = 0.971).
- Fallback table `FALLBACK_BY_SCREEN` is keyed by **exact portrait physical pixels** (short side
  first, via `normScreen()`), NOT by `minW`/`minH` thresholds — thresholds mis-match Oasis
  (1264x1680) onto the Paperwhite 11 entry. It is read only when `measureViewport()` rejects the
  live reading (`<= 200px`). Always end with `FALLBACK_DEFAULT` (600x699, the Kindle 7 measured viewport) so
  the function never returns null.
- `resize` fires on Kindle (and `orientationchange` does NOT) — `init()` already rebinds `fit`.

## Target runtime (most web defaults are wrong here)
The Kindle built-in browser is an old WebKit build (engine ~2009). It is not a
modern browser; code that works in Chrome will silently break.

- **JavaScript: ES5 subset only.** No `const`/`let`, arrow functions, template
  strings, Promises, `fetch`, classes, destructuring, or `for...of`. Use `var`
  and plain DOM APIs. An uncaught error can blank the whole page —
  keep logic defensive.
- **CSS:** `flexbox`, `grid`, and `position: fixed/sticky` are unreliable or
  ignored. Use simple block/float/table layout; webkit-prefixed CSS is more
  reliable. `rem` and media queries work.
- `localStorage` works but is session-only for `file://` pages. The project does not use it.
- E-ink renders **grayscale only**; no SVG or web fonts (falls back to the
  system font).
- Firmware 5.16.4+ (Nov 2023: Scribe, Paperwhite 10/11, Kindle 10/11, Oasis 10)
  modernized the browser (HTML5/JS). Targeting the old-WebKit baseline keeps the
  page working on older devices too — only relax this if the exact device is known.

## Hard constraints to design around
- **Serving:** BOTH work. `file:///mnt/us/<path>/index.html` typed into the Kindle
  address bar works and renders `.html` files from user storage; so does
  `http://<ip>:<port>/` from a LAN server. `data:` URIs and `javascript:` URLs do
  NOT work from the address bar; renderable extensions are
  `.html/.htm/.txt/.jpg/.jpeg/.png/.xml`.
- **Timezone:** the Kindle **hides** its zone from JS. Measured: system clock 13:00
  but `getHours()` returns 5; `getTimezoneOffset()` is always 0; `Intl` does not
  exist on WebKit 531. The zone is undecidable in JS and cannot be inferred even
  online. Therefore the default is a hardcoded UTC+8; `?tz=<hours>` / `?tz=local`
  override it. See the time conventions above before changing any of this.
- **Screen stays awake:** JS cannot stop the screensaver (no Wake Lock). It is
  disabled at the device level: type `~ds` in the search box, or create an empty
  `/mnt/us/TESTD_PREVENT_SCREENSAVER` file and reboot, or (jailbroken)
  `lipc-set-prop -i com.lab126.powerd preventScreenSaver 1`.
- **Fullscreen:** the toolbar/status bar are drawn by the Kindle OS, not the
  page. Without a jailbreak + fullscreen-browser/KUAL extension they cannot be
  hidden.
- **Refresh/flicker:** every repaint causes an e-ink flash/ghost, so the page only
  writes to the DOM when the minute actually changes (`setText` compares first).
  Do NOT introduce a per-second tick or a `<meta http-equiv="refresh">` reload —
  the recursive `setTimeout` already lands on the minute boundary for free and
  without flicker.

## Dev / verification
- The artifact is plain HTML/CSS/JS with no planned build/test tooling.
- Desktop-browser preview is convenient but misleading. Verify on the actual
  Kindle against the constraints above, not just appearance.
- **A desktop browser cannot reproduce the Kindle's browser chrome.** The only way
  to debug real layout is `?debug=1` on the device; report the `vp/scr/cont/fs/rot`
  readout rather than guessing.

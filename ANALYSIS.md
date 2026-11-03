# ClientCheck — Codebase Analysis

**Repo:** `crockyinc/ACA` · **Branch analysed:** `arena/9f7d2ec4-aca` @ `651225c` (= `origin/main`)
**Scope reviewed:** all 724 lines of source (`index.html` 91, `app.js` 245, `styles.css` 359, `data.js` 29), `serve.py`, `wrangler.toml`, `assets/logo.png`
**Method:** static read + behavioural testing of the real `app.js`/`data.js` in a jsdom harness (fetch success / CORS failure / fetch hang / keystroke and search edge cases). No production code was modified in this turn.

---

## 1. What this is

A single-page, zero-build "state lookup" tool for a call-centre / lead-transfer operation. An agent types a 2-letter US state code and gets one card per **client line** that buys leads in that state, showing age limit, income filter, schedule, form link, credentials, instructions and branch code. A sidebar shows live clocks for Pakistan (PKT) and the four US zones so agents know who is open to receive transfers.

| File | Role |
|---|---|
| `index.html` | Single page: search panel, verified banner, `#results-body`, sidebar clocks |
| `app.js` | IIFE. Fetches a Google Sheet CSV → normalises rows → filter + render; live clocks |
| `data.js` | Offline seed dataset (`window.STATE_DATA`), 5 client lines × states = **67 rows**, mirrors the sheet |
| `styles.css` | All styling, CSS vars, responsive grid (single breakpoint at 900px) |
| `serve.py` | Local dev server on `:8000`, `no-store` headers |
| `wrangler.toml` | Cloudflare Workers static-assets deploy, serves repo root |

**Stack:** vanilla ES5-style JS, no dependencies, no build step, no tests, no CI. Total payload ≈ 61 KB (logo is 13 KB) — loads instantly. Deploy target is Cloudflare static assets → **the whole repo root is public**.

Verdict: the *architecture* is appropriate for the job (tiny, static, cheap). The problems are in **data integrity, failure handling, and credential exposure**, not in the structure.

---

## 2. How it actually behaves (verified by test)

Data flow: `loadLiveData()` → `fetch(SHEET_CSV_URL)` → `parseCSV` (hand-rolled, quote/CRLF aware — correct) → `normalizeRows` (keep rows with ≥10 fields and a non-empty `States`) → `matches()` filters with a **prefix** match on column 3 → `render()` builds cards with `createElement`/`textContent` (so **no XSS sink** — good).

Confirmed by harness:

- Offline seed loads, 67 rows, `TX` → 5 cards, each card correctly labelled with line + priority, form links, transfer-to, credentials, instructions.
- With a mocked *successful* sheet fetch, the sheet wins over the seed and re-renders.
- With a failed fetch, the app silently falls back to `data.js` — good intent, but see 3.1.
- Live clocks are correct relative to UTC (PKT `01:02` while UTC `20:02`).
- Timezone badge labels are static (`PST/MST/CST/EST`) — they do **not** flip to PDT/MDT/CDT/EDT during DST. In November that is currently correct; from March–November it will be wrong by an hour's worth of trust.

---

## 3. Findings

### 3.1 🔴 HIGH — The "live" data layer lies to the user when it fails

`app.js:46–65`. The `catch` is empty, and the status line is rewritten even on failure:

```js
.catch(function () {})
.then(function () {
  if (!statusMeta.textContent) {
    statusMeta.textContent = "Updated: " + new Date().toLocaleString() + " · Records: " + data.length;
  }
  status.classList.add("hidden");   // hides "Initializing…" regardless
```

Verified with a rejected fetch: the UI shows **"State Database Ready" + "Updated: <now> · Records: 67"** while it is actually serving the hard-coded `data.js` seed, and `status` is hidden. The timestamp is *the current time*, not the data's age. Consequences for the business:

- An operator who edits the Google Sheet and finds the change missing has no signal — the page claims freshness with the current clock.
- If the sheet fetch is CORS-blocked (most likely in production, see 3.3) the app is silently **permanently frozen at the seed data**, which is why `data.js` "mirrors the sheet" and must be hand-edited by a developer for every rate/schedule change. That is a real operating cost.
- A failed refresh click gives zero feedback.

**Fix:** distinguish `live` / `cached seed` / `stale` in the pill+status, print the *fetch* time (`lastLoaded`), not `new Date()`, and surface the error text on the refresh button. ~20 lines.

### 3.2 🔴 HIGH — Live production credentials are committed to a public repo

`data.js:12`

```js
var CREDS = "User Name: trackagent\nPassword: feinsurance6v8Ad&p#FX";
```

This is rendered as the **CREDENTIALS** tile on the A10 and A3 cards, and `wrangler.toml` publishes the repo root, so it is served as plain text from the production origin — and it is in `git` history on a **public** GitHub repo (`crockyinc/ACA`). Anyone who opens devtools, `view-source:data.js`, or the repo gets a working login for `insurancefinal.com/wp-admin`. Also note the password is nearly identical in shape to an earlier-looking one (`feinsurance…`), so it has probably already been rotated by hand — i.e. this file lags reality.

This is also why the sheet is pulled client-side at all (so nobody has to redeploy to change a password) — the design and the security problem are the same problem.

**Fix (in order):** rotate the credential now; move it out of client code (server-side reveal endpoint behind the same auth as the dashboard, or a Cloudflare Worker secret + per-user token); at minimum stop shipping it in `data.js` and stop mirroring it into the repo, and purge it from history before this goes any further.

### 3.3 🟠 MEDIUM — Google Sheet "live" fetch is fragile and unverifiable from here

`SHEET_CSV_URL` is the `/export?format=csv` endpoint of a sheet on a third-party account. Two problems:

1. **CORS/redirect behaviour is undefined for this document.** The export endpoint 302s to `googleusercontent.com`, and depending on sharing settings the response may not carry `Access-Control-Allow-Origin`. I could not verify this from the sandbox (only github/npm/pypi egress), so treat it as "must be tested in a real browser" — but the failure mode if it breaks is silent (3.1).
2. **No freshness/caching control, no `AbortController` timeout.** If Google hangs, `status` stays at "Initializing State Database…" forever (verified with a hanging fetch), and every refresh click starts another unbounded request.

Also: the app does a full CSV download then filters in memory — fine at 67 rows, would get slow in the thousands.

**Fix:** fetch through a tiny Worker route that proxies + caches the CSV (`caches.default`, 5-min TTL), add a 5–8s `AbortController` timeout, send `cache: "no-store"` only on explicit refresh.

### 3.4 🟠 MEDIUM — Search UX has dead ends and a bad hint

`app.js:68–71`, verified:

- **Typing one letter shows "No states match "T""** — an error message for a query the UI already promised would just wait ("results appear once 2 letters are typed"). `matches()` returns `false` for `q.length < 2`, so every 1-character state shows the failure state. Should stay silent until 2 chars.
- **Prefix-only match.** `GA` finds nothing (no client covers Georgia), but `ga.` finds one — because `data.js` contains the typo `"GA."`. Meanwhile `TX ` (trailing space) → 0 cards; the code trims, so that is actually fine, but the empty-state message echoes the *untrimmed* input: `No states match "tx "` while the field holds `TX ` — confusing.
- **No way to browse.** There is no list of supported states. An agent must guess codes; 31 of 50 states have no coverage at all, and nothing in the UI says so. A "covered states" chip row (derived from data, count on each chip) would remove most of the wasted searches.
- No auto-focus on load, no `datalist`, no fuzzy match on the line name (agents search "A10" or "web form" and get nothing). Search only matches column 3; searching `A10`, `AMLP`, `TCPA` returns nothing.

### 3.5 🟠 MEDIUM — Data quality defects in the shipped dataset

I parsed all 67 rows. Concrete bugs:

| # | Issue | Impact |
|---|---|---|
| 1 | `"GA."` (trailing period) in `A10_STATES` | Georgia shows under `A10` only if the agent types `GA.`; also drops that row out of any `^[A-Z]{2}$` validation |
| 2 | `A4` has an **empty priority** while `A2` is "4th Priority" | Ordering silently depends on array order, not priority; a sheet resort reorders cards |
| 3 | "Priorty" misspelling is the sheet's own header (mirrored in `data.js` comment, and the column is never displayed anyway) | Only the *column* is unused — the value is shown glued into the card title as `— 1st Priority` |
| 4 | `A3` (3rd Priority) has **empty SCHEDULE** | Card renders `TIMINGS —`; agent can't tell if the line is open |
| 5 | Form Link values are **mixed types**: `"web Form 1"` (a label, not a URL) vs three different dashboard URLs, one of which is `/wp-admin` (a login page, not a form) | Agents are told to click through to a link that is either meaningless or a login wall |
| 6 | Prefix/suffix inconsistency: `"A6 CPL: Blind Transfer"` vs `"A10 CPL : Warm Transfer"` (space before colon), `"A3 New line Blind Transfer"` | Looks unmaintained; hurts any later parsing/keying by line name |
| 7 | `A6` transfer target is the *line name* (`r[0]`) and branch code is `"Please select AMLP"` — a UI instruction pasted into a data field | "TRANSFER TO" shows the queue name and "BRANCH CODE" shows an instruction; the two fields are semantically swapped/dirty |
| 8 | `A6` form link `"web Form 1"` never becomes a link | Verified: renders as plain text in the blue box |
| 9 | Age/income are free-text (`"Between 18-64 Years"`, `"Less than 50k"`) | Cannot be validated or machine-filtered later |

**Fix:** add a validation script (CI or a pre-commit hook) asserting: states match `^[A-Z]{2}$`, priority ∈ known set and unique, schedule non-empty, form links are absolute URLs or a known sentinel, no duplicate (line, state). That check would have caught 1, 2, 4, 8 automatically.

### 3.6 🟡 MEDIUM — Accessibility gaps (some good bones already)

Good: skip link, `role="status"` on the status line, `aria-describedby`, real `<kbd>` hints, `aria-label` on sections, colour contrast mostly strong.

Missing, verified in DOM:

- **No `<label>` for the search input** (only a placeholder + a paragraph). Placeholder disappears on typing; screen-reader users get an unlabelled textbox. Add `aria-label` or a visually-hidden `<label for="state-input">`.
- **Results are not announced.** `#results-body` has no `aria-live`, and the verified banner (`✔ STATE VERIFIED`) has none either, so a screen-reader user typing gets silence while cards appear. Add `aria-live="polite"` to a short results summary (not the whole card list).
- `role="status"` is used for the load message but then permanently hidden — fine, but pair with 3.1.
- Focus is never moved or restored after a search; `Clear` does restore focus (good), `Enter` does not.
- Emoji used as the only icon in tiles/labels (🗺 🎂 💰 etc.) are read aloud by many screen readers as "world map", "birthday cake" — should be `aria-hidden="true"` with a text label already present (the label is there, so just add `aria-hidden`).
- `.tile-wide { grid-column: span 2 }` + `nowrap` + `ellipsis` on TIMINGS clips schedule text at narrow widths (it is a full sentence "Mon - Fri |7:00 PM to 5:00 AM | PKT"). Ellipsis on operational data is a real risk: `Mon - Fri |7:00 PM…` hides the AM cut-off.

### 3.7 🟡 LOW — Dead code / small warts

- `instructionsTile()` (`app.js:90–110`) is **fully built but never called** — `render()` uses a plain `tile("INSTRUCTIONS", …)` instead, so instructions render as a `\n`-joined blob inside `.tile-value` with `white-space: pre-line` (verified: no `<ul>`, text shows a literal newline) instead of the intended bulleted list. Either wire it up (it is the better rendering) or delete it.
- `.tile-instructions { grid-column: 1 / -1 }` and `.bullet-list` styles exist only for that dead path.
- `instructionsTile` comment `// lookup value: States` and the `data.js` header comment for "Priorty" carry the sheet's typo forward.
- Cache-busting is manual and inconsistent (`styles.css?v=6`, `data.js?v=4`, `app.js?v=7`) — on a no-build static host this is the right idea, but there is no automation; a forgotten bump ships stale JS to agents. Hash or `?v=<git sha>` via the deploy would fix it.
- `serve.py` sets `allow_reuse_address` **after** import on the class — it works, but it is a class attribute that is already `True` on most systems; dead safety net. `wrangler.toml` has no `[observability]`, no cache headers, no custom domain — header config for a static asset worker belongs in `_headers` or a minimal worker.
- `README.md` is one line (`# ClientCheck`). No run instructions, no data-source explanation, no credential policy. For a repo whose entire value is "how do I change a rate safely", that is the biggest documentation gap.
- No `.gitignore`, no `package.json`/`npm test`, no formatter/linter. Nothing to run locally except `python3 serve.py`.

### 3.8 🟡 LOW — Maintainability shape

- `data.js` duplicates the sheet by hand — two sources of truth that already disagree (the `GA.` typo and the credentials strongly suggest drift). Better: single source (sheet) + a generated `data.js` produced by a `npm run sync` script, or drop the seed entirely and show an honest error state.
- `render()` rebuilds the whole DOM on every keystroke. At 67 rows that is imperceptible; it also throws away focus-independent state, which is why nothing is announced. Fine now, worth an `AbortController`-style guard (debounce + `requestAnimationFrame`) if coverage grows.
- Everything is one IIFE in `app.js` with module-level `document.getElementById` at load time — cannot be unit-tested without a DOM. The data normalisation and `matches()` are the only logic worth testing and they are currently untestable by construction. Extracting `parseCSV`/`normalizeRows`/`matches` into pure functions in a small `lib.js` would make a 20-line test file possible (my harness had to run the whole page to check `matches`).
- No tests, no CI, no type checking (a `// @ts-check` + JSDoc on the row shape would have caught the `GA.`/empty-schedule class of bug at edit time).

---

## 4. Prioritised plan (no branch changes — all on this branch)

| Priority | Work | Effort | Why |
|---|---|---|---|
| P0 | Rotate the leaked `insurancefinal.com` credential; remove `CREDS` from `data.js`; purge from git history | S | Credential is public *right now* |
| P0 | Honest data status: `live` / `seed` / `stale` + real timestamp + visible fetch error; `AbortController` timeout | S–M | Prevents wrong-rate transfers |
| P1 | Data validation script (state regex, priority set/uniqueness, schedule required, URL check) run in CI + fix `GA.`, A4 priority, A3 schedule, form-link semantics | M | Catches 4 of the 9 data bugs permanently |
| P1 | Search: stay silent until 2 chars, trim in the empty message, add covered-state chips + search by line/form name | M | Removes the "No states match T" dead end |
| P2 | A11y: `<label>`/`aria-label` on input, `aria-live` results summary, `aria-hidden` on decorative emoji, un-clip TIMINGS | S | Cheap, real |
| P2 | Wire up `instructionsTile()` (bullets) or delete it + orphan CSS | S | Cleanup |
| P3 | Worker-side sheet proxy with cache + `_headers`; auto cache-bust via deploy SHA; rewrite `README.md` (run, data source, rotation policy); extract pure functions + first tests | M–L | Long-term maintainability |

---

## 5. Bottom line

Well-scoped little app — right stack, right size, correctly built text nodes (no XSS), sensible offline fallback, and a genuinely useful agent workflow. It is held back by three things: **one live password sitting in public source**, **a data layer that reports success when it has silently failed**, and **a dataset with a handful of concrete defects plus no validation to stop the next one**. All three are small, contained fixes on this branch — P0s are hours, not days. The design decision to fetch the sheet from the browser (so ops can change rates without a deploy) is sound *if* it goes through a Worker proxy with a real error state; as written it is the reason the credential is public *and* the reason the UI can quietly lie.

---

## 6. Fix log — live timezones (follow-up)

Reported symptom: Pakistan clock read `02:17 AM` while Pacific read `12:17 PM` (same instant).

**Diagnosis:** the conversion was not the culprit. At that instant the true UTC was `20:17`, so true PKT was `01:17 AM`; the screenshot was exactly **+1 hour** and the Pacific row was correct, which reproduces only when the *device clock* is one hour fast — verified by shifting the sandbox clock by +3600 s and getting `02:17:03 AM / 01:17:03 PM` character-for-character. The app derived every zone from `Date.now()`, so a wrong device clock silently made every zone wrong, with nothing on screen to reveal it.

Two latent bugs were found in the same code path and fixed at the same time:

1. `new Date(now.toLocaleString("en-US", {...}))` — re-parsing locale output drops the zone, inherits the device zone during parsing, and yields **`Invalid Date` → `NaN:NaN:NaN`** in locales with non-Latin digits (`ar-SA`, `fa-IR`; reproduced).
2. Badges were hard-coded `PST/MST/CST/EST`, so they stayed wrong for the ~8 DST months (`PDT/MDT/CDT/EDT`).

**Changes** (`app.js`, `index.html`, `styles.css`):

- One instant → explicit IANA zone via `Intl.DateTimeFormat.formatToParts()`; no locale round-trip. Verified identical output under `en-US`, `ar-SA`, `fa-IR` and several device timezones.
- Badges now derive from the zone itself: `PST`/`PDT`… for the US, `GMT+5` for Pakistan (`#tz-pkt-offset`), so the offset is always visible.
- Clock-drift guard: compares device time with the same-origin HTTP `Date` header (readable, no CORS) and shows an orange warning above the clocks when the device is >90 s off — this is what would have explained the original report. Silent when offline/opaque.
- Cache busters bumped (`styles.css?v=7`, `app.js?v=8`).

**Verified:** DST boundaries (Jan/Jul/Nov instants), device skew of 0 / ±1 h / +2.5 h, offline header, and a search regression (TX → 5 cards, banner, no JS errors).

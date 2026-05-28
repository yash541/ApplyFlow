# ApplyFlow AI — Full Technical Architecture

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Extension Architecture](#2-extension-architecture)
3. [Feature 1 — Job Match Score Overlay](#3-feature-1--job-match-score-overlay)
4. [Feature 2 — Autofill Engine](#4-feature-2--autofill-engine)
5. [Feature 3 — Application Tracking & Pipeline](#5-feature-3--application-tracking--pipeline)
6. [Feature 4 — Resume Tailoring Integration](#6-feature-4--resume-tailoring-integration)
7. [Feature 5 — In-Page Sign-In Panel](#7-feature-5--in-page-sign-in-panel)
8. [Feature 6 — Popup & Notification Center](#8-feature-6--popup--notification-center)
9. [Runtime Layer](#9-runtime-layer)
10. [Canonical Fingerprinting](#10-canonical-fingerprinting)
11. [Submission Detection Engine](#11-submission-detection-engine)
12. [Multi-Portal Adapter System](#12-multi-portal-adapter-system)
13. [Background Service Worker](#13-background-service-worker)
14. [Chrome Storage Schema](#14-chrome-storage-schema)
15. [Message Protocol](#15-message-protocol)
16. [Build System](#16-build-system)
17. [Data Flow Diagrams](#17-data-flow-diagrams)
18. [Backend & Database](#18-backend--database)
19. [Web App (Next.js)](#19-web-app-nextjs)
20. [Engineering Roadmap — Remaining Work](#20-engineering-roadmap--remaining-work)

---

## 1. System Overview

ApplyFlow AI is a Manifest V3 Chrome extension that runs alongside job portals. It provides:

- **Match score overlay** — AI-powered score showing how well your resume matches a job
- **Autofill engine** — detects and fills application form fields using your profile
- **Application tracker** — tracks job pipeline stages (Saved → Applied → Interview → Offer)
- **Submission detection** — automatically detects when a user submits an application and advances the pipeline
- **Resume tailoring** — launches the web app pre-filled with the current JD
- **In-page auth** — sign-in without leaving the job page

The extension communicates with a FastAPI backend at `http://localhost:8000` and a Next.js web app at `http://localhost:3000`.

**High-level architecture:**

```
Job Portal Page
    ├── Content Script: job-portal.ts / linkedin.ts     ← overlay + submission detection
    ├── Content Script: autofill.ts                     ← form fill
    └── Content Script: prefill-bridge.ts (localhost only)

Chrome Extension
    ├── Background Service Worker: background/index.ts  ← API bridge
    └── Popup: popup.html + Popup.tsx                   ← auth + notifications

External
    ├── Backend API (FastAPI): localhost:8000
    └── Web App (Next.js):     localhost:3000
```

---

## 2. Extension Architecture

### 2.1 Manifest Structure (`manifest.json`)

The manifest defines four distinct content script groups:

| Script | Matches | Purpose |
|---|---|---|
| `linkedin.ts` | `linkedin.com/jobs/*` | LinkedIn overlay |
| `job-portal.ts` + `overlay.css` | 12 ATS/job-board portals | Universal overlay |
| `autofill.ts` | LinkedIn + all major ATS portals | Form autofill badge |
| `prefill-bridge.ts` | `localhost:3000/resume*` | Storage → web app bridge |

**Permissions:**
- `storage` — JWT session, application records, notifications, prefill state
- `activeTab` — read current tab URL for context
- `scripting` — programmatic script injection
- `tabs` — open new tabs for tailor/resume flows

**Host permissions** cover all supported portals plus the API and web app origins.

### 2.2 File Map

```
src/
├── background/
│   └── index.ts                        ← service worker, all API calls
├── content/
│   ├── linkedin.ts                     ← LinkedIn entry point (thin wrapper)
│   ├── job-portal.ts                   ← multi-portal router
│   ├── autofill.ts                     ← autofill badge + panel + fill engine
│   ├── field-detector.ts               ← form field scanner + classifier
│   ├── prefill-bridge.ts               ← extension→web app event bridge
│   ├── signin-panel.ts                 ← in-page sign-in panel
│   ├── overlay.css                     ← shared overlay styles
│   ├── overlay.html                    ← injected overlay shell (web_accessible)
│   ├── runtime/                        ← Sprint 1 & 2 — implemented
│   │   ├── dom-stability.ts            ← smart DOM settle wait (replaces fixed 1500ms)
│   │   ├── navigation-manager.ts       ← centralised SPA navigation watching
│   │   ├── runtime-manager.ts          ← scrapeWithRetries + stale-DOM validation
│   │   ├── session-manager.ts          ← per-tab apply session (in-memory)
│   │   └── ai-extractor.ts             ← Claude fallback when DOM scrape fails
│   ├── submission/                     ← Sprint 2 — implemented
│   │   ├── submission-detector.ts      ← confidence combiner + auto-advance logic
│   │   ├── network-detector.ts         ← fetch/XHR intercept via page-world injection
│   │   └── success-detector.ts         ← redirect URL + DOM success signals
│   ├── tracking/                       ← Sprint 1 — implemented
│   │   └── fingerprint.ts              ← canonical SHA-256 fingerprint per job
│   ├── shared/
│   │   ├── overlay.ts                  ← overlay renderer + action listeners
│   │   ├── portal-runner.ts            ← universal adapter orchestrator
│   │   ├── json-ld.ts                  ← JSON-LD / schema.org parser
│   │   └── toast.ts                    ← toast notification component
│   └── adapters/
│       ├── linkedin.ts
│       ├── greenhouse.ts
│       ├── lever.ts
│       ├── ashby.ts
│       ├── indeed.ts
│       ├── glassdoor.ts
│       ├── wellfound.ts
│       ├── smartrecruiters.ts
│       ├── workable.ts
│       ├── bamboohr.ts
│       ├── jobvite.ts
│       └── icims.ts
└── popup/
    ├── index.tsx                       ← popup mount
    └── Popup.tsx                       ← popup UI (auth + notifications)
```

---

## 3. Feature 1 — Job Match Score Overlay

The overlay is the core feature: a floating panel that appears on any supported job page, showing a match score and pipeline actions.

### 3.1 Adapter Pattern

Every portal is represented by a `JobPortalAdapter` object:

```typescript
interface JobPortalAdapter {
  portalName: string;
  isJobPage(): boolean;
  scrapeJobData(): LinkedInJobData | null | Promise<LinkedInJobData | null>;
  watchNavigation?(onNavigate: () => void): void;
  /**
   * URL search-param whose value must appear in the scraped job URL to confirm
   * fresh content (not stale DOM from the previous job). Used on SPA portals
   * where pushState fires before React re-renders. e.g. "currentJobId" for LinkedIn.
   */
  scrapeUrlParam?: string;
}

type LinkedInJobData = {
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
};
```

### 3.2 `portal-runner.ts` — Universal Orchestrator

`portal-runner.ts` is the central engine. It coordinates all the runtime sub-systems:

```
runPortal(adapter)
    │
    ├── runInit(adapter)   called on load and on every SPA navigation
    │       │
    │       ├── isExtensionValid()?            abort if extension context invalidated
    │       ├── adapter.isJobPage()?           abort if not a job detail page
    │       ├── runId = ++currentRunId         monotonic ID for race-condition guard
    │       ├── clearSession()                 stop previous submission detector
    │       ├── remove stale overlay           prevents wrong-job flash
    │       ├── flushPendingToast()            show resume-saved toast from prev. tab
    │       │
    │       ├── waitForStableDOM()             wait for DOM mutations to settle
    │       │       (stableWindow=600ms, timeout=5000ms — replaces fixed 1500ms)
    │       │
    │       ├── scrapeWithRetries(adapter.scrapeJobData, { expectedUrlParam })
    │       │       up to 3 attempts with 1s/2s backoff
    │       │       validates scraped URL matches current page (stale-DOM guard)
    │       │
    │       ├── [if scrape failed] aiExtractJobData(portal)
    │       │       Claude fallback via POST /api/v1/ai/extract-job
    │       │       threshold: confidence >= 0.5
    │       │
    │       ├── buildFingerprint(portal, jobData)  → SHA-256 canonical hash
    │       ├── setSession({ jobData, fingerprint })
    │       │
    │       ├── → background: LOOKUP_BY_URL (url + fingerprintHash)
    │       │       checks fingerprint first, falls back to raw URL
    │       │
    │       ├── → background: ANALYZE_JOB     get match score from API
    │       │
    │       ├── [if existing.status === "saved"] attachDetector(appId)
    │       │       starts submission detection immediately for saved apps
    │       │
    │       ├── [if existing] → background: RECORD_OBSERVATION (fire-and-forget)
    │       │
    │       └── injectOverlay(score, jobData, existing, fingerprint, onSave)
    │               onSave callback:
    │                   attachDetector(newAppId)
    │                   → background: RECORD_OBSERVATION
    │
    └── adapter.watchNavigation?(() => runInit(adapter))
```

**Race-condition guard:** `currentRunId` is a module-level counter. Each `runInit` call increments it and captures its own `runId`. Any async callback that finds `runId !== currentRunId` silently aborts — this prevents a slow API response from a previous job overwriting the overlay for the current job.

**`isExtensionValid()`** — `chrome.runtime.id` throws or returns undefined after an extension reload. This check prevents ghost content scripts from crashing.

**`flushPendingToast()`** — reads `af_pending_toast` from storage and shows a toast if present.

### 3.3 Job Data Extraction — 6-Tier Strategy

Each portal adapter tries extraction methods in priority order:

#### Tier 1 — JSON-LD (`schema.org/JobPosting`)

Used by: Greenhouse, Lever, Ashby, Glassdoor, SmartRecruiters, Workable, Jobvite, iCIMS.

```typescript
export function extractJobFromJsonLd(): Omit<LinkedInJobData, "url"> | null
```

Scans all `script[type="application/ld+json"]` tags, finds items with `@type === "JobPosting"`, extracts title, `hiringOrganization.name`, description (stripped of HTML), and `jobLocation`.

#### Tier 2 — Public ATS APIs

| Portal | API Endpoint |
|---|---|
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
| Lever | `https://api.lever.co/v0/postings/{company}/{uuid}` |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{company}` (filter by UUID) |

#### Tier 3 — DOM Scraping

Stable `data-testid` / `data-test` attributes and ATS-specific class prefixes:

| Portal | Key selectors |
|---|---|
| Indeed | `[data-testid="jobsearch-JobInfoHeader-title"]`, `#jobDescriptionText` |
| Glassdoor | `[data-test="job-title"]`, `[data-test="employer-name"]`, `[data-test="jobDescriptionContent"]` |
| BambooHR | `[class*="BambooHR-ATS-"] h2`, `[class*="BambooHR-ATS-Description"]` |
| Jobvite | `[class*="jv-header"] h2`, `[class*="jv-job-detail-description"]` |
| iCIMS | `[class*="iCIMS_JobTitle"]`, `[class*="iCIMS_JobContent"]` |

#### Tier 4 — iCIMS iframe fetch

iCIMS embeds job content in a cross-origin iframe. The adapter fetches the iframe src with `?in_iframe=1` appended:

```typescript
const iframeSrc = document.querySelector("iframe#icims_content_iframe")?.src;
const res = await fetch(iframeSrc + "?in_iframe=1", { credentials: "include" });
```

#### Tier 5 — `__NEXT_DATA__` (Wellfound)

Wellfound is a Next.js/Apollo app. Job data lives in the Apollo flat cache inside `#__NEXT_DATA__`:

```typescript
const root = JSON.parse(document.getElementById("__NEXT_DATA__").textContent);
// Try root.props.pageProps.jobTitle / companyName first
// Fall back to Apollo flat cache: root.props.pageProps.apolloState["JobListing:12345"]
```

#### Tier 6 — AI Recovery (`ai-extractor.ts`)

When all DOM scrape attempts fail (portal redesign, React still loading, selector mismatch):

```typescript
// Sends raw page innerText (first 8000 chars) to POST /api/v1/ai/extract-job
// Returns LinkedInJobData only if Claude confidence >= 0.5
const aiJobData = await aiExtractJobData(portal);
```

This tier keeps the extension working after a portal redesign without requiring a code deployment.

#### Last resort — `<title>` tag parse (iCIMS)

```typescript
const pageTitle = document.title.split(/[|\-–]/)[0]?.trim();
```

### 3.4 SPA Navigation Detection

For search-results pages where clicking a job updates the view without a full page reload.

The old pattern (each adapter implementing its own `watchNavigation()`) is replaced by `NavigationManager` in `runtime/navigation-manager.ts`. Adapters declare a strategy; the manager handles the implementation:

| Strategy type | When used | Portals |
|---|---|---|
| `history_api` | pushState/replaceState intercept + popstate | LinkedIn, Wellfound |
| `url_params` | MutationObserver watching query-param changes | Indeed (`jk`/`vjk`), Glassdoor (`jl`) |
| `dom_text` | MutationObserver watching element text change | Glassdoor India (no URL update) |
| `none` | Full page reload on every job | Greenhouse, Lever, Ashby, etc. |

`watchNavigation()` returns a cleanup function that disconnects observers and restores patched history methods.

### 3.5 Overlay Rendering (`shared/overlay.ts`)

`injectOverlay(matchScore, jobData, existingRecord, fingerprint, onSave)` creates and mounts the overlay:

```
#applyflow-overlay
    ├── .af-panel.af-open           ← collapsible panel
    │       ├── .af-header          ← "⚡ ApplyFlow AI" + close button
    │       ├── .af-score-section   ← score ring (0-100) + company/title/tier label
    │       └── .af-actions         ← context-aware:
    │               ├── (no record) → "+ Track this job" button
    │               └── (tracked)   → pipeline bar + advance button + resume row
    └── .af-bubble                  ← collapsed: shows score, click to reopen
```

**Score tiers:**
- `>= 85` → 🟢 Excellent
- `>= 70` → 🔵 Good
- `>= 50` → 🟡 Fair
- `< 50`  → 🔴 Low

The `onSave` callback is called when the user saves a new job from the overlay. `portal-runner.ts` uses it to start the submission detector and record the first observation.

---

## 4. Feature 2 — Autofill Engine

The autofill engine operates independently of the overlay, running on application form pages.

### 4.1 Entry: `autofill.ts`

On page load and on every significant DOM mutation, `run()` is called:

```
DOMContentLoaded / MutationObserver (600ms debounce)
    └── run()
            ├── LinkedIn guard: only run when Easy Apply modal is open
            ├── scanFields(root) → DetectedField[]
            ├── count actionable fields (known + AI-fillable)
            ├── skip if:  actionableCount === 0
            │            dismissedKeys.has(fieldsKey)  — user closed this step
            │            fieldsKey === lastFilledKey AND waitingForNextStep
            └── renderBadge(count) → pull-tab badge appended to document.body
```

**LinkedIn modal scoping:** `scanFields` is scoped to `document.querySelector(".jobs-easy-apply-modal")` to prevent background page fields leaking into the scan.

**MutationObserver config:**

```typescript
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-hidden", "hidden", "data-step", "data-active",
                    "aria-expanded", "aria-selected"],
});
```

`attributes` watching is needed for ATS portals that hide/show steps via CSS class toggling rather than DOM insertion.

### 4.2 Badge UX

```
[⚡ 5]  ← collapsed (52px wide), shows icon + field count
[⚡ 5 | Autofill form  ✕]  ← on hover, expands to reveal label + dismiss button
```

**Dismiss behavior:** clicking ✕ adds the current `fieldsKey` to `dismissedKeys`. The key is a sorted join of all CSS selectors for the actionable fields on that step.

**Multi-step forms:** After a successful fill, `lastFilledKey` is set and `waitingForNextStep = true`. The badge is suppressed until `fieldsKey` changes (form advances to next step).

### 4.3 Field Scanner (`field-detector.ts`)

`scanFields(root)` queries all `input`, `textarea`, `select` elements (excluding `hidden`, `submit`, `button`, `reset`, `image`, `checkbox` types), then for each visible element:

1. **Label extraction** (`extractLabel`) — tries in order:
   - `<label for="id">` (explicit association)
   - Wrapping `<label>` element
   - `aria-label` attribute
   - `aria-labelledby` → resolves referenced IDs
   - Nearest preceding sibling with a label-like tag
   - `fieldset > legend` (for radio groups)
   - `placeholder` / `name` / `id` attribute (last resort)

   **Radio group special case:** Walks up to 5 DOM levels to find the question heading (not the option text).

2. **Classification** (`classify`) — hard type signals first (`email`, `tel`, `file`), then 28 regex rules covering 25 field kinds.

3. **Selector building** (`buildSelector`) — `#id` > `tag[name="..."]` > structural `parent > tag:nth-of-type(N)`.

**Output:** `DetectedField[]` where each field has `uid`, `kind`, `confidence`, `inputType`, `label`, `selector`.

### 4.4 Panel Flow (5 Phases)

```
Phase 1: Detection Panel
    Shows all detected fields with kind badges.
    "Match & Review N fields →" for logged-in users.
    "Sign in to Autofill →" for unauthenticated users.

Phase 2: Loading ("Matching your profile…")
    Visible while GET_MATCHES call is in flight.

Phase 3: Review Sidebar
    One row per actionable field:
    ├── Checkbox (checked by default if value available)
    ├── Field label
    ├── Source badge:
    │     "Profile" = rules-based (known kind OR learned_fields hit)
    │     "AI"      = LLM-matched
    │     "Manual"  = no value found (user must type)
    └── Editable input (single-line or textarea for long/summary fields)
    Footer: "X of N fields ready" + "Fill X fields →"

Phase 4: Loading ("Filling fields…")
    Visible while fill engine runs.

Phase 5: Success Panel
    Shows filled/skipped counts.
    "Learn N answers?" prompt for any field the user typed manually:
       - source !== "rules"
       - kind !== "resume_file"
       - non-empty value
       - non-empty label (not "(no label)")
    "Save to Profile" → SAVE_LEARNED_FIELDS → backend PATCH.
```

The save-to-learn filter intentionally captures **all** manually typed fields — not just `unknown` kind ones. This means known-kind fields the profile doesn't have yet (website, salary, etc.) are also offered for learning.

### 4.5 Fill Engine

`fillFields(confirmed, resumeId)` iterates each confirmed field:

| Element type | Method |
|---|---|
| `<select>` | `fillSelect` — fuzzy match on `option.value` then `option.text` |
| `<input type="radio">` | `fillRadio` — queries all inputs in the same `name` group |
| `<input type="checkbox">` | `fillCheckbox` — parses `yes/true/1` to set checked state |
| `<input type="file">` | `fillResumeFile` — fetches PDF bytes from API, constructs `File`, sets via `DataTransfer` |
| `<input>` / `<textarea>` | `fillText` — uses native value setter + synthetic events |

**React/Vue compatibility:** Uses `Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)` before dispatching `input` and `change` events.

**Between-field delay:** 80ms pause between each fill.

**Visual feedback:** `flashFilled(el)` — purple outline → green over 1.5 seconds.

### 4.6 GET_MATCHES API Call

```typescript
chrome.runtime.sendMessage({
  type: "GET_MATCHES",
  payload: {
    fields: allActionable.map(f => ({ uid, kind, confidence, input_type, label, selector })),
    url: window.location.href,
  }
});
// → background calls: POST /api/v1/autofill/match
// ← response: { matches: FieldMatch[], resume_id: string|null, resume_name: string|null }
```

`FieldMatch`: `{ uid, kind, value, source: "rules" | "ai" | "none", confidence }`

---

## 5. Feature 3 — Application Tracking & Pipeline

### 5.1 LOOKUP_BY_URL

Before rendering the overlay, `portal-runner.ts` sends:

```typescript
chrome.runtime.sendMessage({
  type: "LOOKUP_BY_URL",
  payload: { url: jobData.url, fingerprintHash: fingerprint.hash }
})
// → background: GET /api/v1/applications/lookup?url={encoded}&fingerprint_hash={hash}
// ← AppRecord | null
```

The lookup tries fingerprint hash first (survives URL changes and reposts), then falls back to raw URL for legacy records.

`AppRecord`:
```typescript
{
  id: string;
  company: string;
  role: string;
  status: string;           // "saved" | "applied" | "interview" | "technical" | "offer"
  applied_at: string;
  has_resume: boolean;
  resume_id: string | null;
  ats_score: number | null;
  job_url: string | null;
  fingerprint_hash: string | null;
  portal: string | null;
  canonical_url: string | null;
  external_job_id: string | null;
  ats_metadata: object | null;
}
```

### 5.2 Pipeline State Machine

```
saved → applied → interview → offer
          ↑           ↑
       screening   technical   (aliases: same visual stage)
```

`PIPELINE_LABELS`:
```typescript
{ saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview", offer: "Offer" }
```

`NEXT_STATUS`:
```typescript
{ saved: "applied", applied: "interview", screening: "interview",
  interview: "offer", technical: "offer" }
```

### 5.3 Advance Button

1. Button disabled, text → "Updating…"
2. `UPDATE_APP_STATUS` → `PATCH /api/v1/applications/{id}` with `{ status: nextStatus }`
3. On success: `currentApp.status = nextStatus`, `rerenderActions()` rebuilds pipeline HTML
4. Background fires `pushNotification` on `updateAppStatus`

### 5.4 Save Job (First Track)

```
"+ Track this job" click
    → SYNC_APPLICATION → POST /api/v1/applications/
      (sends: company, role, job_url, job_description, status,
              fingerprint_hash, portal, canonical_url, external_job_id)
    ← { id, ... } or { reposted: true, id, ... } if fingerprint already exists
    → Render tracked overlay
    → attachDetector(app.id)  — start watching for submission
    → RECORD_OBSERVATION (fire-and-forget)
```

If a duplicate fingerprint is detected server-side, the backend returns the existing record with `reposted: true` instead of creating a new row.

---

## 6. Feature 4 — Resume Tailoring Integration

### 6.1 "Tailor Resume" Button

```
Click "✨ Tailor Resume"
    → OPEN_TAILOR → background.ts
    → chrome.storage.local.set({ af_tailor_prefill: { jd, company, role, applicationId } })
    → chrome.tabs.create({ url: "http://localhost:3000/resume" })
```

### 6.2 prefill-bridge.ts (localhost:3000/resume*)

Bridges `chrome.storage` → web app, covering both race conditions:

```typescript
// sessionStorage: React not yet mounted
sessionStorage.setItem("af_tailor_prefill", JSON.stringify(data));
// CustomEvent: React already mounted
window.dispatchEvent(new CustomEvent("af_prefill_ready", { detail: data }));
```

### 6.3 Resume Saved Callback

Web app fires `af_resume_saved` on `window`. `prefill-bridge.ts` catches it:
1. `NOTIFY` → stores in `af_notifications` (popup badge)
2. Sets `af_pending_toast` → shown next time user is on the job page

### 6.4 "Open Resume" Button

```
Click "Open →"
    → OPEN_RESUME → background.ts
    → chrome.storage.local.set({ af_open_resume: { resumeId, applicationId } })
    → chrome.tabs.create({ url: "http://localhost:3000/resume" })
```

`prefill-bridge.ts` fires `af_open_resume` custom event → web app loads the resume.

---

## 7. Feature 5 — In-Page Sign-In Panel

`signin-panel.ts` provides `showSignInPanel(onSuccess?)`. It injects a 300px panel at z-index 2147483648:

```
[⚡ ApplyFlow · Sign In]   [✕]
┌────────────────────────┐
│ Email                  │
├────────────────────────┤
│ Password               │
├────────────────────────┤
│ [error message]        │
├────────────────────────┤
│ Sign In →              │
└────────────────────────┘
```

On success:
1. `POST /api/v1/auth/login`
2. Stores `{ token, user: { id, name, email, plan, createdAt }, expiresAt }` in `chrome.storage.local.session`
3. Calls `onSuccess?.()` — autofill reopens panel with authenticated flow

---

## 8. Feature 6 — Popup & Notification Center

### 8.1 Authentication Flow

`Popup.tsx` has two views:

**`AuthView`** (not signed in):
- `LoginForm` → `POST /api/v1/auth/login` → sets session
- `RegisterForm` → `POST /api/v1/auth/register` → sets session

**`DashboardView`** (signed in):
- Reads `af_notifications` from storage
- Calls `MARK_NOTIFICATIONS_READ` → clears badge
- Shows up to 8 recent notifications

### 8.2 Notification System

`pushNotification(n)` in `background/index.ts`:
- Prepends new notification with UUID + ISO timestamp
- Keeps only last 20
- Sets badge text to unread count (purple `#6366f1`)

Notification types: `success`, `error`, `info`, `warning`

### 8.3 Extension Icon Badge

Purple number on the extension icon = unread notification count. Cleared when popup is opened.

---

## 9. Runtime Layer

**Implemented in Sprint 1 & 2.** Files: `src/content/runtime/`

### 9.1 `dom-stability.ts` — Smart DOM Wait

Replaces the old `await new Promise(r => setTimeout(r, 1500))` in `portal-runner.ts`.

```typescript
await waitForStableDOM({
  stableWindow: 600,    // ms of no DOM mutations = "stable"
  timeout: 5000,        // hard max before resolving anyway
  minDescriptionLength?, // optional: wait until body text is at least N chars
});
```

Implementation: `MutationObserver` resets a debounce timer on every mutation. Resolves when the timer fires with no mutations. Hard fallback resolves after `timeout` ms regardless (graceful degradation for slow corporate SSOs).

### 9.2 `navigation-manager.ts` — Centralised SPA Navigation

Replaces per-adapter `watchNavigation()` with a declarative strategy type:

```typescript
type NavigationStrategy =
  | { type: "url_params"; keys: string[] }   // Indeed, Glassdoor
  | { type: "dom_text"; selector: string }   // Glassdoor India
  | { type: "history_api" }                  // LinkedIn, Wellfound
  | { type: "none" };                        // Greenhouse, Lever, etc.

function watchNavigation(
  strategy: NavigationStrategy,
  onNavigate: () => void,
  valid?: () => boolean,   // defaults to isExtensionValid()
): () => void              // returns cleanup function
```

`history_api` strategy patches `history.pushState` and `history.replaceState` and adds a `popstate` listener. The cleanup function restores the original methods.

`url_params` strategy uses a `MutationObserver` that reads the specified query params on every DOM mutation and fires only when at least one key has a value and the snapshot changed.

### 9.3 `runtime-manager.ts` — scrapeWithRetries

Wraps an adapter's `scrapeJobData()` with automatic retries:

```typescript
async function scrapeWithRetries(
  scrape: () => LinkedInJobData | null | Promise<LinkedInJobData | null>,
  { maxAttempts = 3, backoffMs = 1000, expectedUrlParam }: RetryOptions = {},
): Promise<ScrapeResult | null>
```

A scrape is considered a failure if it throws, returns null, or is missing `title` or `company`.

**Stale-DOM guard (`expectedUrlParam`):** On SPA portals, `pushState` fires before React re-renders. If `scrapeUrlParam` is set on the adapter (e.g. `"currentJobId"` for LinkedIn, `"jk"` for Indeed), `scrapeWithRetries` captures the expected value from the current URL before the first attempt, then validates that the scraped job's URL contains that value. If it doesn't match (stale DOM), it retries with backoff.

### 9.4 `session-manager.ts` — Per-Tab Session (In-Memory)

```typescript
type TabSession = {
  jobData: LinkedInJobData;
  fingerprint: JobFingerprint;
  applicationId?: string;     // set after SYNC_APPLICATION or LOOKUP_BY_URL returns a saved app
  stopDetector?: () => void;  // cleanup fn for the running submission detector
  startedAt: number;
};

setSession(s)         // replaces session, stops previous detector
getSession()          // current session or null
setApplicationId(id)  // called when overlay saves a new job
setStopDetector(fn)   // called when submission detector starts
clearSession()        // called at start of each runInit
```

Stored in module-level memory (not `chrome.storage`) — intentionally ephemeral. Session resets on each new job navigation.

### 9.5 `ai-extractor.ts` — Claude Fallback Extraction

```typescript
async function aiExtractJobData(portal: string): Promise<LinkedInJobData | null>
```

- Takes first 8000 chars of `document.body.innerText`
- Routes through background service worker (`EXTRACT_JOB_AI` message → `POST /api/v1/ai/extract-job`)
- Returns `LinkedInJobData` only if Claude confidence ≥ 0.5
- Returns null on any failure (keeps the extension non-blocking)

---

## 10. Canonical Fingerprinting

**Implemented in Sprint 1.** File: `src/content/tracking/fingerprint.ts`

### 10.1 The Problem

The same job can appear at multiple URLs:
- LinkedIn redirect → `greenhouse.io` direct link
- Job reposted with new `jl=` param on Glassdoor
- Indeed `viewjob?jk=X` vs `/jobs?vjk=X`

Using `job_url` as the sole identity key causes duplicate tracking records.

### 10.2 `JobFingerprint` Type

```typescript
type JobFingerprint = {
  portal: string;              // e.g. "greenhouse", "linkedin"
  canonicalUrl: string;        // URL with tracking params stripped
  externalJobId?: string;      // ATS-native ID extracted from URL
  normalizedCompany: string;   // lowercase, suffix-stripped
  normalizedTitle: string;     // lowercase, seniority-stripped
  normalizedLocation?: string; // city + country only
  hash: string;                // SHA-256 via Web Crypto API
};
```

### 10.3 Hash Priority

```
1. portal + externalJobId       (most stable — survives all URL changes)
2. portal + company + title + location   (survives reposts)
3. canonicalUrl                 (last resort — better than raw URL)
```

### 10.4 Normalization Rules

- **Company:** strip leading `the`, strip `Inc`/`LLC`/`Ltd`/`Co.`/`Corp.`/`Limited`, strip punctuation, lowercase
- **Title:** strip `Senior`/`Sr.`/`Junior`/`Jr.`/`Staff`/`Principal`/`Lead`/`Associate`/level suffixes, strip punctuation, lowercase
- **Location:** city + country only (first two comma-segments), lowercase
- **Canonical URL:** strips all UTM params, `ref`, `refId`, `trk`, `trkInfo`, `originalSubdomain`

### 10.5 External Job ID Extraction (per portal)

| Portal | URL pattern |
|---|---|
| LinkedIn | `/jobs/view/{numericId}` |
| Greenhouse | `/jobs/{numericId}` |
| Lever / Ashby | second path segment (UUID) |
| Indeed | `jk=` or `vjk=` query param |
| Glassdoor | `jl=` or `jobListingId=` query param |
| Wellfound | `/jobs/{numericId}` |
| SmartRecruiters | second path segment |
| Workable | third path segment (shortcode) |
| BambooHR | `/careers/{numericId}` or `id=` param |
| Jobvite | `/job/{jobId}` |
| iCIMS | `/jobs/{numericId}/` |

---

## 11. Submission Detection Engine

**Implemented in Sprint 2.** Files: `src/content/submission/`

### 11.1 Architecture

```
startSubmissionDetector(applicationId, onDetected, onSuggestion)
    ├── startNetworkDetector(onNetworkSignal)
    │       injects <script> into page-world to patch fetch + XHR
    │       listens for window.postMessage(__AF_NETWORK_SIGNAL__)
    │       confidence: 0.6
    │
    └── startSuccessDetector(onSuccessSignal)
            checks immediately on load (handles landing on confirmation pages)
            url MutationObserver → checks URL patterns (confidence 0.8)
            dom MutationObserver → checks DOM selectors + text patterns (confidence 0.75)
```

### 11.2 Confidence Model

| Signals | Combined confidence | Action |
|---|---|---|
| Network only | 0.6 | Suggestion toast "Did you just apply?" + "Mark Applied" button |
| DOM only | 0.75–0.80 | Auto-advance to "applied" |
| Network + DOM | 0.93–0.95 | Auto-advance to "applied" (high confidence) |

`AUTO_ADVANCE_THRESHOLD = 0.72` — DOM signals always auto-advance; network-only never does.

### 11.3 `network-detector.ts` — Page-World Injection

Content scripts run in an isolated world and cannot patch `window.fetch`. `network-detector.ts` injects a `<script>` element into the real page world that:
1. Patches `window.fetch` to intercept POSTs to known apply endpoints
2. Patches `XMLHttpRequest.prototype.open` + `send` similarly
3. Posts `{ type: "__AF_NETWORK_SIGNAL__", url, method }` via `window.postMessage`

The content script listens for this message. The injected `<script>` tag is removed from the DOM immediately after execution.

**Apply endpoint patterns detected:**

```
/applyJobPosting          LinkedIn
/jobs/applystart          Indeed
desktopapply/submit       Indeed legacy
/apply\b                  Greenhouse, Lever, Ashby
/submit[-_]?application   generic ATS
/job[-_]?application      generic ATS
/careers/apply            generic
/application/submit       SmartRecruiters
/applications$            Wellfound, Workable
/resumes/apply            BambooHR
```

### 11.4 `success-detector.ts` — DOM + Redirect Signals

**URL patterns:**
`application-submitted`, `apply-confirm`, `application-complete`, `/thank-you`, `applicationSubmitted=true`, `/success`, `/confirmation`, `applied=true`

**DOM selectors:**
`[data-test*="application-submitted"]`, `[data-automation*="confirmation"]`, `[aria-label*="application submitted"]`, `[class*="ApplicationConfirmation"]`, `[class*="submission-success"]`

**Text patterns:**
`"application submitted"`, `"successfully applied"`, `"we received your application"`, `"thank you for applying"`, `"application complete"`, `"application was sent"`

### 11.5 On Detection

**Auto-advance (confidence ≥ 0.72):**
```typescript
chrome.runtime.sendMessage({
  type: "UPDATE_APP_STATUS",
  payload: {
    id: appId,
    status: "applied",
    atsMetadata: {
      applicationId, detectedAt, networkEndpoint,
      domSignalKind, domSignalDetail, confidence
    }
  }
});
showToast("success", "Applied detected!", `${company} · ${role} — moved to Applied`);
```

**Suggestion (0.55 ≤ confidence < 0.72):**
Toast with "Did you just apply?" + "Mark Applied" button (network-only trigger).

---

## 12. Multi-Portal Adapter System

### 12.1 Router: `job-portal.ts`

Routes to the correct adapter by `location.hostname`:

```typescript
const adapter =
  host === "boards.greenhouse.io"      ? greenhouseAdapter :
  host === "jobs.lever.co"             ? leverAdapter :
  host === "jobs.ashbyhq.com"          ? ashbyAdapter :
  host.endsWith(".indeed.com") || host === "indeed.com" ? indeedAdapter :
  host.includes("glassdoor.")          ? glassdoorAdapter :
  host === "wellfound.com"             ? wellfoundAdapter :
  host === "jobs.smartrecruiters.com"  ? smartrecruitersAdapter :
  host === "apply.workable.com"        ? workableAdapter :
  host.endsWith(".bamboohr.com")       ? bamboohrAdapter :
  host === "jobs.jobvite.com"          ? jobviteAdapter :
  host.endsWith(".icims.com")          ? icimsAdapter :
  null;
```

Note `endsWith` / `includes` for portals with variable subdomains (BambooHR, iCIMS, Indeed, Glassdoor).

### 12.2 Per-Adapter Details

| Portal | `isJobPage()` check | Primary extraction | SPA navigation |
|---|---|---|---|
| LinkedIn | `/jobs/view/` in path OR `currentJobId` in URL | DOM (`data-job-id`) | `history_api` + `scrapeUrlParam: "currentJobId"` |
| Greenhouse | `/COMPANY/jobs/NUMERIC_ID` path | JSON-LD → Boards API | `none` |
| Lever | `/COMPANY/UUID` path | JSON-LD → Postings API | `none` |
| Ashby | `/COMPANY/UUID` path (length > 20, contains dash) | JSON-LD → Board API | `none` |
| Indeed | `/viewjob` OR `jk=` param OR `/jobs` + `vjk=` | DOM (`data-testid`) | `url_params: ["jk","vjk"]` + `scrapeUrlParam: "jk"` |
| Glassdoor | `/job-listing/` OR `jl=`/`jobListingId=` OR `/Job/` + title visible | JSON-LD → DOM | `url_params: ["jl"]` then `dom_text: [data-test="job-title"]` |
| Wellfound | `/jobs/ID-slug` OR `/company/slug/jobs/ID-slug` | `__NEXT_DATA__` → JSON-LD → DOM | `none` |
| SmartRecruiters | 2 path segments, 2nd starts with digit | JSON-LD → DOM (`data-qa`) | `none` |
| Workable | `/COMPANY/j/SHORTCODE` | JSON-LD → DOM (`data-ui`) | `none` |
| BambooHR | `/careers/ID` OR `/jobs/view.php?id=` | DOM (`BambooHR-ATS-` class) | `none` |
| Jobvite | path contains `/job/JOBID` | JSON-LD → DOM (`jv-` class) | `none` |
| iCIMS | `/jobs/NUMERIC_ID/job` path | JSON-LD → DOM → iframe fetch → title tag | `none` |

---

## 13. Background Service Worker

`background/index.ts` is a Manifest V3 service worker. All API calls from content scripts go through it.

### 13.1 Auth Helper: `authedFetch`

```typescript
async function authedFetch(url, init = {}) {
  const token = await getToken();  // reads from chrome.storage.local.session
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (res.status === 401) {
    await chrome.storage.local.remove("session");  // auto-logout on token expiry
  }
  return res;
}
```

### 13.2 Message Handlers

| Message type | Handler | API call |
|---|---|---|
| `ANALYZE_JOB` | `analyzeJob` | `POST /api/v1/ai/match` |
| `GET_SESSION` | reads storage | no API call |
| `SYNC_APPLICATION` | `syncApplication` | `POST /api/v1/applications/` (with fingerprint fields) |
| `OPEN_TAILOR` | `openTailorTab` | sets storage, opens tab |
| `OPEN_RESUME` | `openResumeTab` | sets storage, opens tab |
| `CHECK_APPLICATION` | `checkApplication` | `GET /api/v1/applications/check?company=&role=` |
| `LOOKUP_BY_URL` | `lookupByUrl` | `GET /api/v1/applications/lookup?url=&fingerprint_hash=` |
| `UPDATE_APP_STATUS` | `updateAppStatus` | `PATCH /api/v1/applications/{id}` (with optional `ats_metadata`) |
| `GET_PROFILE` | `getProfile` | `GET /api/v1/profile/` |
| `GET_MATCHES` | `getMatches` | `POST /api/v1/autofill/match` |
| `GET_RESUME_PDF` | `getResumePdfBytes` | `GET /api/v1/resumes/{id}/pdf-bytes` |
| `NOTIFY` | `pushNotification` | updates storage + badge |
| `MARK_NOTIFICATIONS_READ` | `markAllRead` | updates storage + clears badge |
| `SAVE_LEARNED_FIELDS` | `saveLearnedFields` | `PATCH /api/v1/profile/learned-fields` |
| `EXTRACT_JOB_AI` | `extractJobAi` | `POST /api/v1/ai/extract-job` |
| `RECORD_OBSERVATION` | `recordObservation` | `POST /api/v1/observations/{applicationId}` |

---

## 14. Chrome Storage Schema

All keys in `chrome.storage.local`:

| Key | Type | Set by | Read by | Purpose |
|---|---|---|---|---|
| `session` | `{ token, user, expiresAt }` | Popup / signin-panel | background (all auth'd calls) | JWT auth token + user info |
| `af_notifications` | `AppNotification[]` (max 20) | background `pushNotification` | Popup DashboardView | Notification history |
| `af_pending_toast` | `{ type, title, body, action? }` | prefill-bridge (af_resume_saved) | portal-runner `flushPendingToast` | Toast queued for next job page visit |
| `af_tailor_prefill` | `{ jd, company, role, applicationId? }` | background `openTailorTab` | prefill-bridge | Job data for resume tailor page |
| `af_open_resume` | `{ resumeId, applicationId }` | background `openResumeTab` / popup | prefill-bridge | Resume to open in editor |
| `af_last_fill` | `{ items, url, timestamp }` | autofill.ts after fill | (debug / future use) | Last autofill run record |

**In-memory only (not in chrome.storage):**

| Variable | Module | Purpose |
|---|---|---|
| `TabSession` | `runtime/session-manager.ts` | Current job's data, fingerprint, appId, detector cleanup fn |
| `currentRunId` | `shared/portal-runner.ts` | Monotonic counter for race-condition guard |
| `dismissedKeys` | `content/autofill.ts` | Field-set keys the user dismissed this session |

---

## 15. Message Protocol

```typescript
type ExtensionMessage =
  | { type: "ANALYZE_JOB";          payload: LinkedInJobData }
  | { type: "GET_SESSION" }
  | { type: "SYNC_APPLICATION";     payload: {
        jobData: LinkedInJobData; status: string;
        fingerprintHash?: string; portal?: string;
        canonicalUrl?: string; externalJobId?: string;
    }}
  | { type: "OPEN_TAILOR";          payload: { jd: string; company: string; role: string; applicationId?: string } }
  | { type: "OPEN_RESUME";          payload: { resumeId: string; applicationId: string } }
  | { type: "CHECK_APPLICATION";    payload: { company: string; role: string } }
  | { type: "LOOKUP_BY_URL";        payload: { url: string; fingerprintHash?: string } }
  | { type: "UPDATE_APP_STATUS";    payload: { id: string; status: string; atsMetadata?: Record<string, unknown> } }
  | { type: "GET_PROFILE" }
  | { type: "GET_MATCHES";          payload: { fields: unknown[]; url: string; job_context?: string } }
  | { type: "GET_RESUME_PDF";       payload: { resumeId: string } }
  | { type: "NOTIFY";               payload: Omit<AppNotification, "id" | "timestamp" | "read"> }
  | { type: "MARK_NOTIFICATIONS_READ" }
  | { type: "SAVE_LEARNED_FIELDS";  payload: { fields: Record<string, string> } }
  | { type: "EXTRACT_JOB_AI";       payload: { pageText: string; url: string; portal?: string } }
  | { type: "RECORD_OBSERVATION";   payload: {
        applicationId: string; extractionMethod: string;
        portal?: string; isLive?: boolean; signals?: Record<string, unknown>;
    }};
```

All handlers return `true` from `onMessage` to signal async response.

---

## 16. Build System

Built with **Vite 5** using a custom `vite.config.ts`:
- Outputs to `dist/`
- Copies `manifest.json` and icon assets unchanged
- Bundles each content script as a separate ES module chunk
- The manifest references source paths; Vite resolves and rewrites to hashed output filenames

**Loader pattern:** Each entry is a tiny stub that dynamically imports the actual bundle, sidestepping Manifest V3's module type restrictions.

**Build command:** `npm run build` → `vite build` → `dist/` — load as unpacked extension in Chrome.

---

## 17. Data Flow Diagrams

### 17.1 Job Page → Overlay (full pipeline)

```
User opens wellfound.com/jobs/123-product-manager
            │
Chrome injects job-portal.ts → wellfoundAdapter
            │
runPortal(wellfoundAdapter) → runInit()
    ├── isJobPage() → true
    ├── clearSession(), remove stale overlay
    ├── flushPendingToast()
    ├── waitForStableDOM(stableWindow=600ms, timeout=5000ms)
    ├── scrapeWithRetries(scrapeJobData, maxAttempts=3)
    │       attempt 1 → extractFromNextData() → success
    │       return { jobData: { title, company, ... }, attempts: 1 }
    │
    ├── buildFingerprint("wellfound", jobData)
    │       externalJobId = "123" (from /jobs/123-slug)
    │       hashInput = "wellfound:job:123"
    │       hash = SHA-256("wellfound:job:123")
    │
    ├── setSession({ jobData, fingerprint })
    │
    ├── →[msg] LOOKUP_BY_URL { url, fingerprintHash }
    │   → background → GET /api/v1/applications/lookup?url=...&fingerprint_hash=...
    │   ← AppRecord | null
    │
    ├── →[msg] ANALYZE_JOB → background → POST /api/v1/ai/match
    │   ← { overall_score: 78 }
    │
    ├── [if AppRecord.status === "saved"] attachDetector(appId)
    │       startNetworkDetector() — patches fetch/XHR in page world
    │       startSuccessDetector() — watches URL changes + DOM mutations
    │
    ├── [if AppRecord] →[msg] RECORD_OBSERVATION (fire-and-forget)
    │
    └── injectOverlay(78, jobData, appRecord, fingerprint, onSave)
```

### 17.2 Autofill: Badge → Fill → Learn

```
User opens greenhouse.io/jobs/123 form
            │
autofill.ts → MutationObserver (600ms debounce) → run()
    → scanFields() → [email, phone, full_name, linkedin, work_auth, resume_file]
    → renderBadge(6)
            │
User clicks badge → openPanel(fields)
    → GET_SESSION → logged in
    → renderDetectionPanel(fields)
            │
User clicks "Match & Review 6 fields →"
    → renderLoadingPanel("Matching your profile…")
    →[msg] GET_MATCHES → POST /api/v1/autofill/match
    ←[msg] {
        matches: [
          { uid, value: "john@...", source: "rules", confidence: 0.95 },   // email
          { uid, value: "+1 555...", source: "rules", confidence: 0.95 },  // phone
          { uid, value: "John Doe", source: "rules", confidence: 0.95 },   // full_name
          { uid, value: "linkedin.com/in/...", source: "rules", ... },     // linkedin
          { uid, value: "US Citizen", source: "rules", ... },              // work_auth
          { uid, value: null, source: "none", confidence: 0 },             // resume_file (handled by fill engine)
        ],
        resume_id: "abc-tailored",
        resume_name: "Greenhouse Resume v2"
      }
            │
renderReviewSidebar() — user edits "years of experience" field (source: "Manual")
            │
User clicks "Fill 6 fields →"
    → fillFields(confirmed, "abc-tailored")
        email    → fillText("john@example.com")        ✓ flash purple→green
        phone    → fillText("+1 555 0100")             ✓
        fullName → fillText("John Doe")                ✓
        workAuth → fillSelect("US Citizen")            ✓
        file     → fillResumeFile("abc-tailored")
                    →[msg] GET_RESUME_PDF → GET /api/v1/resumes/abc/pdf-bytes
                    ← { pdf_bytes: "JVBERi0x..." }
                    → new File([bytes], "resume.pdf") → DataTransfer → el.files ✓
            │
renderSuccessPanel(filled=6, skipped=0)
    learnedItems = [{ label: "years of experience", value: "4" }]
    ("years of experience" was source:"Manual" — offered for learning)
            │
User clicks "Save to Profile"
    →[msg] SAVE_LEARNED_FIELDS → PATCH /api/v1/profile/learned-fields
    Next time this field appears → source: "rules", confidence: 0.8 (from learned_fields)
```

### 17.3 Submission Auto-Detection

```
User is on greenhouse.io form (status: "saved")
    → portal-runner already called attachDetector(appId)
    → network-detector injected fetch/XHR patch into page world
    → success-detector watching URL + DOM

User fills out form and clicks "Submit Application"
    → fetch("https://boards.greenhouse.io/applications", { method: "POST" })
    → page-world patch fires → postMessage({ type: "__AF_NETWORK_SIGNAL__", url, method })
    → network-detector receives signal → confidence: 0.6
    → evaluate(): confidence 0.6 < AUTO_ADVANCE_THRESHOLD (0.72) — suggestion only

    [0.5s later] DOM updates to show confirmation banner
    → success-detector DOM observer fires
    → checkDom() → [class*="ApplicationConfirmation"] found → confidence: 0.75
    → evaluate(): combined confidence = min(0.6 + 0.75*0.6, 0.95) = 0.95
    → autoAdvanced = true

    →[msg] UPDATE_APP_STATUS { id: appId, status: "applied", atsMetadata: { confidence: 0.95, ... } }
    → background → PATCH /api/v1/applications/{appId}
    → pushNotification("Moved to Applied")
    → showToast("success", "Applied detected!", "Greenhouse · Product Manager — 95% confidence")
    → clearSession()
```

### 17.4 Track → Tailor → Return Toast

```
User clicks "+ Track this job"
    →[msg] SYNC_APPLICATION { jobData, status: "saved", fingerprintHash, portal, ... }
    → POST /api/v1/applications/
    ← { id: "app_xyz", fingerprint_hash: "abc123", ... }
    → overlay re-renders with tracked view
    → attachDetector("app_xyz")
    →[msg] RECORD_OBSERVATION { applicationId: "app_xyz", extractionMethod: "dom", ... }
    → background pushNotification("Job tracked!")

User clicks "✨ Tailor Resume"
    → storage.set({ af_tailor_prefill: { jd, company, role, applicationId: "app_xyz" } })
    → chrome.tabs.create("http://localhost:3000/resume")

On localhost:3000/resume — prefill-bridge.ts:
    → storage.get("af_tailor_prefill") → found → remove
    → sessionStorage.setItem("af_tailor_prefill", ...)
    → dispatchEvent(new CustomEvent("af_prefill_ready", { detail }))
    [Web app picks up, pre-fills JD, starts tailoring]

User saves tailored resume:
    → dispatchEvent(new CustomEvent("af_resume_saved", { detail: { resumeId: "res_1", ... } }))
    prefill-bridge.ts:
    →[msg] NOTIFY → pushNotification("Resume saved!")
    → storage.set({ af_pending_toast: { ... } })

User returns to job page:
    runInit() → flushPendingToast()
    → showToast("success", "Resume ready! ✓", "Wellfound · Product Manager",
                { label: "Open Resume →", onClick: OPEN_RESUME })
```

---

## 18. Backend & Database

### 18.1 Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (`Mapped[]` type annotations) |
| Async driver | asyncpg |
| Database | PostgreSQL (UUID primary keys, JSONB columns) |
| Migrations | Alembic |
| Auth | bcrypt + python-jose (JWT HS256) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) via `anthropic` SDK |
| Config | pydantic-settings (reads `.env`) |

**Connection setup (`core/database.py`):**
```python
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```

`expire_on_commit=False` — prevents a second DB round-trip when returning data immediately after commit.

---

### 18.2 Database Schema

#### Table: `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `uuid4()` |
| `name` | `VARCHAR(255)` | NOT NULL |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE, indexed |
| `hashed_password` | `VARCHAR(255)` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()`, on update |

Relationships: one-to-many → `resumes`, `applications`; one-to-one → `user_profiles`

---

#### Table: `user_profiles`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` CASCADE DELETE, UNIQUE |
| `data` | `JSONB` | NOT NULL, default `{}` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, on update |

**Design rationale:** JSONB blob avoids migrations when adding new profile fields.

**Full `data` JSONB schema:**
```json
{
  "phone": "",
  "location": "City, State, Country",
  "linkedin": "",
  "github": "",
  "website": "",
  "headline": "Senior Software Engineer",
  "summary": "2–3 sentence professional summary",
  "experience": [
    {
      "title": "Software Engineer",
      "company": "Acme Corp",
      "duration": "Jan 2022 – Present",
      "current": true,
      "bullets": ["Built X", "Led Y"]
    }
  ],
  "education": [
    { "degree": "BS Computer Science", "institution": "MIT", "year": "2020" }
  ],
  "skills": ["Python", "React", "PostgreSQL"],
  "years_experience": 5,
  "work_authorization": "US Citizen",
  "requires_sponsorship": false,
  "salary_min": 120000,
  "salary_max": 160000,
  "salary_currency": "USD",
  "willing_to_relocate": false,
  "relocation_details": "",
  "remote_preference": "flexible",
  "notice_period": "2 weeks",
  "gender": "",
  "ethnicity": "",
  "disability_status": "",
  "veteran_status": "",
  "learned_fields": {
    "years of experience with react": "4",
    "preferred work style": "async-first remote"
  }
}
```

`learned_fields` — keys are normalised form-field labels (lowercase trimmed), values are answers confirmed during past autofill sessions. Used as a `"rules"` source (confidence 0.8, "Profile" badge). Now consulted for **all** field kinds (not just `unknown`) — if a known-kind field has no profile value, its normalised label is checked against `learned_fields` before falling back to "none".

---

#### Table: `resumes`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` |
| `type` | `VARCHAR(20)` | `"base"` or `"tailored"` |
| `name` | `VARCHAR(255)` | nullable, human-readable label |
| `filename` | `VARCHAR(255)` | nullable, original upload filename |
| `content` | `TEXT` | nullable, extracted plain text (base only) |
| `tailored_content` | `JSONB` | nullable, full AI-generated JSON (tailored only) |
| `application_id` | `UUID` | FK → `applications.id` SET NULL, indexed, nullable |
| `ats_score` | `INTEGER` | nullable, 0–100 |
| `pdf_bytes` | `TEXT` | nullable, base64-encoded PDF (set on tailored save) |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**`tailored_content` JSONB schema:**
```json
{
  "name": "John Doe",
  "contact": { "email": "...", "phone": "...", "location": "...", "linkedin": "..." },
  "summary": "Tailored 2–3 sentence summary",
  "experience": [
    { "company": "Acme", "title": "SWE", "duration": "Jan 2022 – Present", "bullets": ["..."] }
  ],
  "education": [{ "institution": "MIT", "degree": "BS CS", "year": "2020" }],
  "skills": ["Python", "React"],
  "keywords_added": ["TypeScript", "System Design"],
  "ats_score": 87
}
```

**PDF bytes:** When the user saves a tailored resume from the web editor, the frontend renders it to PDF, base64-encodes it, and sends it in the save request. The extension reads `pdf_bytes` via `GET_RESUME_PDF` for file-upload fields.

---

#### Table: `applications`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` |
| `company` | `VARCHAR(255)` | NOT NULL |
| `role` | `VARCHAR(255)` | NOT NULL |
| `job_url` | `VARCHAR(2048)` | nullable, legacy lookup key |
| `job_description` | `TEXT` | nullable |
| `notes` | `TEXT` | nullable |
| `status` | `VARCHAR(50)` | `"saved"` default |
| `fingerprint_hash` | `VARCHAR(64)` | nullable, indexed, SHA-256 canonical hash |
| `portal` | `VARCHAR(50)` | nullable, e.g. `"greenhouse"` |
| `canonical_url` | `VARCHAR(2048)` | nullable, tracking-params-stripped URL |
| `external_job_id` | `VARCHAR(255)` | nullable, ATS-native job ID |
| `ats_metadata` | `JSONB` | nullable, submission detection signals |
| `applied_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, on update |

**`ats_metadata` JSONB schema** (set when submission detection auto-advances):
```json
{
  "applicationId": "uuid",
  "detectedAt": "2026-05-28T12:00:00Z",
  "networkEndpoint": "/applications",
  "domSignalKind": "dom_element",
  "domSignalDetail": "[class*=\"ApplicationConfirmation\"]",
  "confidence": 0.95
}
```

**Fingerprint deduplication:** `POST /applications/` checks for an existing record with the same `fingerprint_hash` before inserting. If found, returns the existing record with `reposted: true`. This is a server-side safety net; the primary dedup happens in the extension overlay via `LOOKUP_BY_URL`.

---

#### Table: `job_observations`

Records every time the extension scrapes a tracked job posting. Used for extraction-method analytics and future lifecycle tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `application_id` | `UUID` | FK → `applications.id` CASCADE DELETE, indexed |
| `user_id` | `UUID` | FK → `users.id` |
| `observed_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `is_live` | `BOOLEAN` | NOT NULL, default `true` |
| `extraction_method` | `VARCHAR(20)` | `"dom"` \| `"ai"` \| `"json_ld"` |
| `portal` | `VARCHAR(50)` | nullable |
| `signals` | `JSONB` | nullable, e.g. `{ "score": 78, "attempts": 1 }` |

---

### 18.3 Entity Relationship Diagram

```
users
  │  id (PK)
  │  email (UNIQUE, indexed)
  │  hashed_password
  │
  ├──< user_profiles (1:1)
  │       user_id (FK → users.id, UNIQUE, CASCADE DELETE)
  │       data (JSONB) — all profile fields + learned_fields
  │
  ├──< applications (1:many)
  │       user_id (FK → users.id)
  │       company, role, job_url, job_description, status
  │       fingerprint_hash, portal, canonical_url, external_job_id
  │       ats_metadata (JSONB)
  │       │
  │       ├──< job_observations (1:many)
  │       │       application_id (FK → applications.id, CASCADE DELETE)
  │       │       is_live, extraction_method, portal, signals (JSONB)
  │       │
  │       └──< resumes (1:1 tailored per application)
  │               type = "tailored"
  │               application_id (FK → applications.id, SET NULL)
  │               tailored_content (JSONB), ats_score, pdf_bytes
  │
  └──< resumes (1:many base)
          type = "base"
          filename, content (plain text)
```

---

### 18.4 Alembic Migrations

| Revision | Description |
|---|---|
| `73f1526e6c2c` | Initial — creates `users`, `applications`, `resumes` (base only) |
| `b3e8f2a1c9d7` | Adds `resumes.type`, `tailored_content`, `application_id`, `ats_score`; `applications.job_url`, `notes`; makes `resumes.filename`/`content` nullable |
| `c4a7d1e8f302` | Adds `user_profiles` table |
| `d5f3a2b8e1c9` | Adds `resumes.pdf_bytes`, `resumes.name` |
| `e6g4b3c0d2e1` | Adds `applications.fingerprint_hash` (indexed), `portal`, `canonical_url`, `external_job_id`; adds `applications.ats_metadata` (JSONB) |
| `f7h5c4d1e3f2` | Creates `job_observations` table with `application_id` FK (CASCADE DELETE) index |

Run: `alembic upgrade head`

---

### 18.5 Authentication

**Registration** (`POST /api/v1/auth/register`):
1. Check email uniqueness
2. `bcrypt.hashpw(password, gensalt())`
3. INSERT into `users`
4. Return JWT: `{"sub": user_id, "exp": now + 24h}` signed with `SECRET_KEY` (HS256)

**Login** (`POST /api/v1/auth/login`):
1. SELECT WHERE email
2. `bcrypt.checkpw`
3. Return same JWT structure

**JWT validation (`core/deps.py`):**
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user = await db.execute(select(User).where(User.id == uuid.UUID(payload["sub"])))
    return user.scalar_one_or_none()
```

Auto-logout: extension's `authedFetch` calls `chrome.storage.local.remove("session")` on any 401.

---

### 18.6 API Endpoints Reference

All routes prefixed `/api/v1`. All except `/auth/login` and `/auth/register` require `Authorization: Bearer <token>`.

#### Auth (`/auth`)

| Method | Path | Notes |
|---|---|---|
| POST | `/login` | Returns JWT, 401 if invalid |
| POST | `/register` | Returns JWT, 409 if email taken |
| GET | `/me` | Returns current user info from token |

#### Applications (`/applications`)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | All applications, ordered newest first, eager loads `tailored_resume` |
| POST | `/` | Create; accepts fingerprint fields; returns existing + `reposted: true` if fingerprint already exists |
| GET | `/{id}` | Full detail including `job_description` |
| PATCH | `/{id}` | Partial update — status, notes, job_url, job_description, company, role, `ats_metadata` |
| DELETE | `/{id}` | Hard delete |
| GET | `/lookup?url=&fingerprint_hash=` | Fingerprint lookup first, raw URL fallback |
| GET | `/check?company=&role=` | Case-insensitive company+role match |

#### Resumes (`/resumes`)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | List view (no content/tailored_content) |
| GET | `/base` | Latest base resume (used as AI tailoring input) |
| POST | `/upload` | Parse PDF/DOCX/TXT, store extracted text as `type="base"` |
| POST | `/tailored` | UPSERT tailored resume — UPDATE if `application_id`+`type=tailored` exists |
| PUT | `/{id}` | Update `tailored_content`, `name`, `pdf_bytes` |
| GET | `/{id}` | Full detail |
| GET | `/{id}/pdf-bytes` | Returns `pdf_bytes` for extension file upload |
| DELETE | `/{id}` | Hard delete |

#### Profile (`/profile`)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Merges DB data with `_default_profile()` defaults |
| PUT | `/` | Full replace of data JSONB blob |
| PUT | `/name` | Updates `users.name` |
| POST | `/import-resume` | Claude extracts structured profile from resume text |
| PATCH | `/learned-fields` | Merges new answers into `data.learned_fields` |

#### AI (`/ai`)

| Method | Path | Notes |
|---|---|---|
| POST | `/match` | Returns hardcoded score 75 (real scoring TBD) |
| POST | `/tailor` | Streams Claude resume rewrite (SSE) |
| POST | `/chat` | Streams Claude career coach (SSE) |
| POST | `/extract-job` | AI fallback job extraction from raw page text (used by `ai-extractor.ts`) |

#### Autofill (`/autofill`)

| Method | Path | Notes |
|---|---|---|
| POST | `/match` | Rules pass → learned-fields check → Claude AI pass |

#### Observations (`/observations`)

| Method | Path | Notes |
|---|---|---|
| POST | `/{application_id}` | Record a job observation (fire-and-forget from extension) |
| GET | `/{application_id}` | Return last 50 observations for one application |
| GET | `/analytics/overview` | Aggregate stats: by_status, by_portal, recent_7d, extraction method breakdown |

---

### 18.7 Autofill Match Pipeline (Backend)

`POST /api/v1/autofill/match` runs two sequential passes:

**Pass 1 — Rules matcher** (`_rules_match`):

Maps each field `kind` to a profile value. No AI cost.

```
email          → current_user.email
full_name      → current_user.name
first_name     → name.split()[0]
last_name      → " ".join(name.split()[1:])
phone/location/city/state/country/linkedin/github/website/headline
work_auth/requires_sponsorship/salary/years_experience/notice_period
remote_preference/willing_to_relocate/gender/ethnicity/disability/veteran
resume_file    → null (handled by fill engine)
summary/unknown → queued for Pass 2
```

**Learned fields check** (within Pass 1, before queuing for AI):

- For `unknown` kind: check `profile.learned_fields[normalised_label]`. If found → source `"rules"`, confidence 0.8.
- For any other kind where `_rules_match` returns null: also check `profile.learned_fields[normalised_label]`. If found → source `"rules"`, confidence 0.8. This handles fields like `website` or `salary` that the user has filled manually before but haven't set in their profile yet.

**Pass 2 — AI matcher** (`_ai_match`):

One Claude call for all remaining `summary` and `unknown` fields. Sends profile context + list of `{uid, label, kind}` tuples. Returns JSON map `{uid: value | null}`.

**Resume resolution:** After both passes, looks up the application by `job_url`, finds its linked tailored resume with non-null `pdf_bytes`, returns `resume_id` and `resume_name` for pre-selecting the file upload field.

---

### 18.8 AI Integration

All AI calls use `settings.ANTHROPIC_API_KEY` and `settings.DEFAULT_AI_MODEL` (`claude-sonnet-4-6`).

| Endpoint | Claude usage | Streaming |
|---|---|---|
| `POST /ai/tailor` | Full resume rewrite — base text + JD → structured JSON | Yes (SSE `data: {"chunk": "..."}`) |
| `POST /ai/chat` | Career coach Q&A | Yes (SSE) |
| `POST /profile/import-resume` | Extract structured profile from resume text | No (sync) |
| `POST /autofill/match` | Fill `summary`/`unknown` form fields | No (sync) |
| `POST /ai/extract-job` | Extract job data from raw page text (DOM fallback) | No (sync, max 512 tokens) |

**Streaming format:**
```
data: {"chunk": "{\n  \"name\":"}
data: {"chunk": " \"John Doe\","}
...
data: [DONE]
```

The web app accumulates chunks and JSON-parses when `[DONE]` is received.

**`/ai/extract-job` request/response:**
```python
# Request
{ "page_text": "...",   # first 8000 chars of page innerText
  "url": "https://...",
  "portal": "wellfound" }  # optional hint

# Response
{ "title": "Product Manager",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "description": "First 400 chars...",
  "confidence": 0.85,
  "extracted_by": "ai" }
```

---

### 18.9 Configuration (`core/config.py`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/applyflow` | Async PostgreSQL DSN |
| `REDIS_URL` | `redis://localhost:6379` | Reserved for future use |
| `SECRET_KEY` | `"CHANGE_ME_IN_PRODUCTION"` | JWT signing key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) | JWT lifetime |
| `ANTHROPIC_API_KEY` | `""` | Required for AI features |
| `DEFAULT_AI_MODEL` | `claude-sonnet-4-6` | Claude model for all AI calls |
| `DEBUG` | `false` | Enables SQLAlchemy query logging |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |

---

## 19. Web App (Next.js)

The web app at `http://localhost:3000` is the companion dashboard to the Chrome extension.

### 19.1 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| State | Zustand (`store/auth.ts`, `store/resumeLab.ts`) |
| API client | `src/lib/api.ts` — thin fetch wrapper |
| PDF rendering | `@react-pdf/renderer` + Web Worker (`workers/pdf.worker.ts`) |
| Auth guard | `src/middleware.ts` + `components/auth/AuthGuard.tsx` |

### 19.2 Route Map

```
/ (landing page)
/login              ← auth
/signup             ← auth
/dashboard          ← stats + quick actions
/applications       ← Kanban pipeline board
/resume             ← Resume Lab (main AI feature)
/profile            ← Master profile form
/interview          ← Interview prep (placeholder)
/demo-apply         ← autofill demo page (development only)
```

### 19.3 Key Components

**`components/resume/ResumeLab.tsx`** — the core feature:
- Loads base resume and job description
- Calls `POST /api/v1/ai/tailor` (SSE streaming)
- Streams AI-generated tailored content into the editor in real time
- Tabs: Edit / Preview (HTML) / PDF
- Dispatches `af_resume_saved` when user saves → triggers extension toast

**`components/resume/ResumeSplitEditor.tsx`** — split-pane editor:
- Left: section-by-section form (summary, experience bullets, skills, etc.)
- Right: live HTML preview or PDF preview

**`components/resume/pdf/` — PDF template library:**
| Template | Description |
|---|---|
| `ModernTemplate.tsx` | Default — clean two-column layout |
| `ClassicTemplate.tsx` | Traditional single-column |
| `MinimalTemplate.tsx` | Minimal whitespace |
| `ATSSafeTemplate.tsx` | Plain text, no columns — ATS-optimised |
| `ExecutiveTemplate.tsx` | Executive/senior format |

**`components/applications/KanbanBoard.tsx`** — drag-and-drop pipeline:
- Columns: Saved → Applied → Interview → Offer
- Each card shows company, role, applied date, resume badge
- Calls `PATCH /api/v1/applications/{id}` on card move

**`components/dashboard/AutofillProfilePanel.tsx`** — autofill readiness:
- Shows profile completeness score
- Highlights which fields are missing for autofill

**`components/profile/MasterProfileForm.tsx`** — full profile editor:
- All autofill fields in one form
- Calls `PUT /api/v1/profile/`

### 19.4 Auth Flow (Web App)

`middleware.ts` protects all `/dashboard`, `/applications`, `/resume`, `/profile`, `/interview` routes. Unauthenticated requests are redirected to `/login`.

`store/auth.ts` (Zustand) holds the JWT token and user object. `LoginForm` / `SignupForm` call the backend and hydrate the store.

### 19.5 Extension ↔ Web App Bridge

The web app and extension communicate via:

| Direction | Mechanism |
|---|---|
| Extension → Web app | `chrome.storage.local` keys (`af_tailor_prefill`, `af_open_resume`) read by `prefill-bridge.ts` |
| Extension → Web app | `CustomEvent("af_prefill_ready")` dispatched on `window` |
| Web app → Extension | `CustomEvent("af_resume_saved")` dispatched on `window`, caught by `prefill-bridge.ts` |

The web app does NOT directly call `chrome.runtime` — all cross-context communication flows through `window` events and `chrome.storage`, which is accessible to the content script on `localhost:3000`.

### 19.6 PDF Worker

`workers/pdf.worker.ts` renders `@react-pdf/renderer` templates in a Web Worker to avoid blocking the UI during PDF generation. The main thread posts the tailored resume JSON; the worker returns a base64-encoded PDF blob which is then:
1. Displayed in `PdfViewer.tsx`
2. Sent as `pdf_bytes` in the `PUT /api/v1/resumes/{id}` save request

---

## 20. Engineering Roadmap — Remaining Work

### Status of Sprints 1 & 2 (Completed ✅)

Sprint 1 and 2 items from the original roadmap are now fully implemented:

| Component | Status |
|---|---|
| `waitForStableDOM()` | ✅ Implemented (`runtime/dom-stability.ts`) |
| `NavigationManager` | ✅ Implemented (`runtime/navigation-manager.ts`) |
| `scrapeWithRetries` + stale-DOM guard | ✅ Implemented (`runtime/runtime-manager.ts`) |
| `buildFingerprint()` | ✅ Implemented (`tracking/fingerprint.ts`) |
| DB: `fingerprint_hash`, `portal`, `canonical_url`, `external_job_id` | ✅ Implemented |
| Session manager (per-tab, in-memory) | ✅ Implemented (`runtime/session-manager.ts`) |
| Network submission detector | ✅ Implemented (`submission/network-detector.ts`) |
| DOM/redirect success detector | ✅ Implemented (`submission/success-detector.ts`) |
| Confidence combiner + auto-advance | ✅ Implemented (`submission/submission-detector.ts`) |
| DB: `ats_metadata` JSONB on applications | ✅ Implemented |
| AI fallback extraction | ✅ Implemented (`runtime/ai-extractor.ts` + `POST /ai/extract-job`) |
| Job observations table | ✅ Implemented (`job_observations` table + `/observations` router) |
| `RECORD_OBSERVATION` message + handler | ✅ Implemented |
| `EXTRACT_JOB_AI` message + handler | ✅ Implemented |

---

### Sprint 3 — Lifecycle Tracking (Remaining)

**Goal:** Notify users when jobs they applied to are removed or expired.

| Task | Files |
|---|---|
| Closure detection (DOM signals + apply-button watch) | `lifecycle/lifecycle-engine.ts` (new) |
| `lifecycle_status` + `lifecycle_checked_at` fields on applications | Alembic migration |
| `job_lifecycle_events` table (state transition audit log) | Alembic migration |
| Background revalidation scheduler (backend) | `apps/api/app/tasks/revalidate.py` (new) |
| Notification on lifecycle change | `background/index.ts` |

**Multi-signal closure detection:**

| Signal | Method | Indicates |
|---|---|---|
| HTTP 404 on `job_url` | Background HEAD/GET | Removed |
| HTTP 410 | Background HEAD/GET | Permanently removed |
| DOM text: "job expired" / "no longer accepting" | Text scan | Expired/closed |
| Apply button `disabled`/`hidden`/absent | DOM query | Closed |
| JSON-LD block absent (was previously present) | Compare vs last observation | Closed/removed |

**Revalidation frequency:**
| Job age | Frequency |
|---|---|
| 0–7 days | Every 12 hours |
| 7–30 days | Daily |
| 30+ days | Weekly |

---

### Sprint 4 — Platform Stability (Remaining)

| Task | Files |
|---|---|
| `Telemetry.track()` + background batch flush | `telemetry/tracker.ts` (new), `background/index.ts` |
| `portal_telemetry_events` DB table | Alembic migration |
| Telemetry summary API endpoint | `apps/api/app/api/v1/endpoints/telemetry.py` (new) |
| Confidence-typed extraction (`ExtractedField<T>`) | `shared/types.ts` |
| Declarative adapter config migration | `adapters/greenhouse.ts`, `adapters/lever.ts` |

**Telemetry events to track:**

| Event | Trigger |
|---|---|
| `job_scrape_success` | extraction succeeded |
| `job_scrape_failed` | all strategies exhausted |
| `ai_recovery_triggered` | AI fallback used |
| `selector_miss` | named selector returned null |
| `submission_detected` | submission engine fired |
| `spa_navigation` | `watchNavigation` callback fired |
| `extension_context_invalidated` | `isExtensionValid()` returned false |
| `lifecycle_changed` | job status changed from active |

---

### Sprint 5 — Advanced Intelligence (Remaining)

| Task | Files |
|---|---|
| Repost detection logic | `lifecycle/lifecycle-engine.ts` |
| Job observation analytics queries | `apps/api/app/api/v1/endpoints/analytics.py` |
| Salary change tracking (diff between observations) | `lifecycle/lifecycle-engine.ts` |
| Real AI match scoring (replace hardcoded 75) | `apps/api/app/api/v1/endpoints/ai.py` |

---

### What Does NOT Change

| Component | Status |
|---|---|
| Portal adapter interface | Keep, optionally evolve toward declarative |
| `injectOverlay()` rendering | Keep as-is |
| Autofill engine (`autofill.ts`, `field-detector.ts`) | Keep as-is |
| Background service worker message protocol | Keep, add `TELEMETRY` message type |
| `chrome.storage` schema for session/notifications | Keep as-is |
| `prefill-bridge.ts` → web app bridge | Keep as-is |
| Popup React UI | Keep as-is |
| FastAPI + SQLAlchemy backend structure | Keep, add new endpoints/tables |
| Alembic migration workflow | Keep, add new migrations |
| Vite build system | Keep as-is |
| Next.js web app structure | Keep as-is |

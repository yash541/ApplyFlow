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
9. [Multi-Portal Adapter System](#9-multi-portal-adapter-system)
10. [Background Service Worker](#10-background-service-worker)
11. [Chrome Storage Schema](#11-chrome-storage-schema)
12. [Message Protocol](#12-message-protocol)
13. [Build System](#13-build-system)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Backend & Database](#15-backend--database)
16. [Engineering Roadmap — Production-Grade Architecture](#16-engineering-roadmap--production-grade-architecture)

---

## 1. System Overview

ApplyFlow AI is a Manifest V3 Chrome extension that runs alongside job portals. It provides:

- **Match score overlay** — AI-powered score showing how well your resume matches a job
- **Autofill engine** — detects and fills application form fields using your profile
- **Application tracker** — tracks job pipeline stages (Saved → Applied → Interview → Offer)
- **Resume tailoring** — launches the web app pre-filled with the current JD
- **In-page auth** — sign-in without leaving the job page

The extension communicates with a FastAPI backend at `http://localhost:8000` and a Next.js web app at `http://localhost:3000`.

**High-level architecture:**

```
Job Portal Page
    ├── Content Script: job-portal.ts / linkedin.ts     ← overlay
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
│   └── index.ts               ← service worker, all API calls
├── content/
│   ├── linkedin.ts            ← LinkedIn entry point (thin wrapper)
│   ├── job-portal.ts          ← multi-portal router
│   ├── autofill.ts            ← autofill badge + panel + fill engine
│   ├── field-detector.ts      ← form field scanner + classifier
│   ├── prefill-bridge.ts      ← extension→web app event bridge
│   ├── signin-panel.ts        ← in-page sign-in panel
│   ├── overlay.css            ← shared overlay styles
│   ├── overlay.html           ← injected overlay shell (web_accessible)
│   ├── shared/
│   │   ├── overlay.ts         ← overlay renderer + action listeners
│   │   ├── portal-runner.ts   ← universal adapter orchestrator
│   │   ├── json-ld.ts         ← JSON-LD / schema.org parser
│   │   └── toast.ts           ← toast notification component
│   └── adapters/
│       ├── linkedin.ts        ← LinkedIn adapter
│       ├── greenhouse.ts      ← Greenhouse adapter
│       ├── lever.ts           ← Lever adapter
│       ├── ashby.ts           ← Ashby adapter
│       ├── indeed.ts          ← Indeed adapter
│       ├── glassdoor.ts       ← Glassdoor adapter
│       ├── wellfound.ts       ← Wellfound adapter
│       ├── smartrecruiters.ts ← SmartRecruiters adapter
│       ├── workable.ts        ← Workable adapter
│       ├── bamboohr.ts        ← BambooHR adapter
│       ├── jobvite.ts         ← Jobvite adapter
│       └── icims.ts           ← iCIMS adapter
└── popup/
    ├── index.tsx              ← popup mount
    └── Popup.tsx              ← popup UI (auth + notifications)
```

---

## 3. Feature 1 — Job Match Score Overlay

The overlay is the core feature: a floating panel that appears on any supported job page, showing a match score and pipeline actions.

### 3.1 Adapter Pattern

Every portal is represented by a `JobPortalAdapter` object implementing this interface:

```typescript
interface JobPortalAdapter {
  portalName: string;
  isJobPage(): boolean;
  scrapeJobData(): LinkedInJobData | null | Promise<LinkedInJobData | null>;
  watchNavigation?(onNavigate: () => void): void;
}

type LinkedInJobData = {
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
};
```

**`isJobPage()`** — guards against running on search pages or non-job pages. Returns true only when the page displays a single job detail.

**`scrapeJobData()`** — may be sync or async. Returns the structured job data or null if extraction fails.

**`watchNavigation()`** — optional. For SPA portals that update the visible job without a full page reload. Calls `onNavigate()` whenever the user navigates to a different job.

### 3.2 `portal-runner.ts` — Universal Orchestrator

```
runPortal(adapter)
    │
    ├── runInit(adapter)         immediately on page load
    │       │
    │       ├── isExtensionValid()?   abort if extension was reloaded mid-tab
    │       ├── adapter.isJobPage()?  abort if not a job detail page
    │       ├── flushPendingToast()   show any saved toast from previous navigation
    │       ├── wait 1500ms           SPA portals need time to finish rendering
    │       ├── adapter.scrapeJobData()
    │       ├── → background: LOOKUP_BY_URL   check if we've tracked this job before
    │       ├── → background: ANALYZE_JOB     get match score from API
    │       └── injectOverlay(score, jobData, existingRecord)
    │
    └── adapter.watchNavigation?(() => runInit(adapter))
            Fires runInit again on every SPA navigation
```

**`isExtensionValid()`** — `chrome.runtime.id` throws or returns undefined after an extension reload. This check prevents ghost content scripts from crashing.

**`flushPendingToast()`** — reads `af_pending_toast` from storage and shows a toast if present. This is how a "Resume saved!" notification appears back on the job page after the user returns from the tailor tab.

### 3.3 Job Data Extraction — 3-Tier Strategy

Each portal adapter tries extraction methods in priority order:

#### Tier 1 — JSON-LD (`schema.org/JobPosting`)

```typescript
// shared/json-ld.ts
export function extractJobFromJsonLd(): Omit<LinkedInJobData, "url"> | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const raw = JSON.parse(script.textContent);
    const candidates = Array.isArray(raw) ? raw : [raw];
    for (const item of candidates) {
      if (item["@type"] !== "JobPosting") continue;
      // Extract title, hiringOrganization.name, description (stripped of HTML), jobLocation
    }
  }
}
```

Used by: Greenhouse, Lever, Ashby, Glassdoor, SmartRecruiters, Workable, Jobvite, iCIMS (where present).

#### Tier 2 — Public ATS APIs

For Phase 2 portals with open APIs, adapters make authenticated-free REST calls:

| Portal | API Endpoint |
|---|---|
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
| Lever | `https://api.lever.co/v0/postings/{company}/{uuid}` |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{company}` (filter by UUID) |

#### Tier 3 — DOM Scraping

Stable `data-testid` / `data-test` attributes, ATS-specific class prefixes, and structural fallbacks:

| Portal | Key selectors |
|---|---|
| Indeed | `[data-testid="jobsearch-JobInfoHeader-title"]`, `#jobDescriptionText` |
| Glassdoor | `[data-test="job-title"]`, `[data-test="employer-name"]`, `[data-test="jobDescriptionContent"]` |
| BambooHR | `[class*="BambooHR-ATS-"] h2`, `[class*="BambooHR-ATS-Description"]` |
| Jobvite | `[class*="jv-header"] h2`, `[class*="jv-job-detail-description"]` |
| iCIMS | `[class*="iCIMS_JobTitle"]`, `[class*="iCIMS_JobContent"]` |

#### Tier 4 — iCIMS iframe fetch

iCIMS embeds job content in a cross-origin iframe. The adapter fetches the iframe src with `?in_iframe=1` appended to get a clean same-origin HTML page:

```typescript
const iframeSrc = document.querySelector("iframe#icims_content_iframe")?.src;
const targetUrl = iframeSrc + (iframeSrc.includes("?") ? "&" : "?") + "in_iframe=1";
const res = await fetch(targetUrl, { credentials: "include" });
const doc = new DOMParser().parseFromString(await res.text(), "text/html");
```

#### Tier 5 — `__NEXT_DATA__` (Wellfound)

Wellfound is a Next.js/Apollo app. Job data lives in the Apollo flat cache inside `#__NEXT_DATA__`:

```typescript
const root = JSON.parse(document.getElementById("__NEXT_DATA__").textContent);
// Try root.props.pageProps.jobTitle / companyName first
// Fall back to Apollo flat cache: root.props.pageProps.apolloState["JobListing:12345"]
```

#### Tier 6 — `<title>` tag parse (iCIMS last resort)

```typescript
const pageTitle = document.title.split(/[|\-–]/)[0]?.trim();
```

### 3.4 SPA Navigation Detection

For search-results pages where clicking a job updates the view without a full page reload:

| Portal | Detection method |
|---|---|
| LinkedIn | MutationObserver watching `location.href` for `currentJobId` param change |
| Indeed | MutationObserver watching `jk`/`vjk` URL param change |
| Glassdoor (URL) | MutationObserver watching `jl` URL param change |
| Glassdoor (SPA-only) | MutationObserver watching `[data-test="job-title"]` text change |

Glassdoor India (`glassdoor.co.in`) doesn't update the URL when selecting a job from the list — the selected job title change in the DOM is the only signal.

### 3.5 Overlay Rendering (`shared/overlay.ts`)

`injectOverlay(matchScore, jobData, existingRecord)` creates and mounts the overlay:

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
            │            fieldsKey === lastFilledKey AND waitingForNextStep  — same step re-scan
            └── renderBadge(count) → pull-tab badge appended to document.body
```

**LinkedIn modal scoping:** On LinkedIn, the Easy Apply modal overlays the job page. `scanFields` is scoped to `document.querySelector(".jobs-easy-apply-modal")` to prevent background page fields leaking into the scan.

**MutationObserver config:**

```typescript
observer.observe(document.body, {
  childList: true,        // catches React/Vue step transitions (DOM add/remove)
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-hidden", "hidden", "data-step", "data-active",
                    "aria-expanded", "aria-selected"],
});
```

`attributes` watching is needed for ATS portals that hide/show steps via CSS class toggling rather than DOM insertion.

### 4.2 Badge UX

The badge is a pull-tab fixed to the right edge of the viewport:

```
[⚡ 5]  ← collapsed (52px wide), shows icon + field count
[⚡ 5 | Autofill form  ✕]  ← on hover, expands to reveal label + dismiss button
```

**Dismiss behavior:** clicking ✕ adds the current `fieldsKey` to `dismissedKeys` (a `Set<string>`). The key is a sorted join of all CSS selectors for the actionable fields on that step. The badge will not reappear for the same step's field set in this page session.

**Multi-step forms:** After a successful fill, `lastFilledKey` is set to the current `fieldsKey` and `waitingForNextStep = true`. The badge is suppressed until `fieldsKey` changes (i.e., the form advances to a step with different fields). This prevents the badge from immediately re-appearing on the same step after fill.

### 4.3 Field Scanner (`field-detector.ts`)

`scanFields(root)` queries all `input`, `textarea`, `select` elements (excluding `hidden`, `submit`, `button`, `reset`, `image`, `checkbox` types), then for each visible element:

1. **Label extraction** (`extractLabel`) — tries in order:
   - `<label for="id">` (explicit association)
   - Wrapping `<label>` element
   - `aria-label` attribute
   - `aria-labelledby` → resolves referenced IDs
   - Nearest preceding sibling with a label-like tag (`LABEL`, `SPAN`, `DIV`, `P`, `LEGEND`)
   - `fieldset > legend` (for radio groups)
   - `placeholder` / `name` / `id` attribute (last resort)

   **Radio group special case:** For radio inputs, `label[for]` returns the *option* text ("Yes"/"No"), not the *question*. The extractor walks up to 5 levels of the DOM tree to find a preceding sibling heading.

2. **Classification** (`classify`) — first checks hard type signals:
   - `type="email"` → `email` (confidence 1.0)
   - `type="tel"` → `phone` (confidence 0.9)
   - `type="file"` → `resume_file` (confidence 0.8)
   - `type="hidden"` → `unknown` (confidence 0)

   Then builds a signal string from `label + name + id + placeholder` and tests against 28 regex rules covering 25 field kinds (identity, location, social, professional, EEO, file).

3. **Selector building** (`buildSelector`) — builds a stable CSS selector for the element:
   - `#id` if the element has an ID
   - `tag[name="..."]` if it has a name attribute
   - Structural `parent > tag:nth-of-type(N)` as a last resort (recursive)

**Output:** `DetectedField[]` where each field has `uid`, `kind`, `confidence`, `inputType`, `label`, `selector`.

### 4.4 Panel Flow (5 Phases)

```
Phase 1: Detection Panel
    Shows all detected fields with kind badges (classified / AI / unknown).
    "Match & Review N fields →" button for logged-in users.
    "Sign in to Autofill →" for unauthenticated users.

Phase 2: Loading ("Matching your profile…")
    Visible while GET_MATCHES call is in flight.

Phase 3: Review Sidebar
    One row per actionable field:
    ├── Checkbox (checked by default if value available)
    ├── Field label
    ├── Source badge (Profile = rules-based, AI = LLM-matched)
    └── Editable input (single-line or textarea for long/summary fields)
    Footer: "X of N fields ready" + "Fill X fields →"

Phase 4: Loading ("Filling fields…")
    Visible while fill engine runs.

Phase 5: Success Panel
    Shows filled/skipped counts.
    "Learn N answers?" prompt for AI-generated values not already in profile.
    "Save to Profile" → SAVE_LEARNED_FIELDS message → backend PATCH.
```

### 4.5 Fill Engine

`fillFields(confirmed, resumeId)` iterates each confirmed field item, resolves the element by CSS selector, and calls the appropriate filler:

| Element type | Method |
|---|---|
| `<select>` | `fillSelect` — fuzzy match on `option.value` then `option.text` |
| `<input type="radio">` | `fillRadio` — queries all inputs in the same `name` group, fuzzy match on value/label |
| `<input type="checkbox">` | `fillCheckbox` — parses `yes/true/1` to set checked state |
| `<input type="file">` | `fillResumeFile` — fetches PDF bytes from API, constructs `File`, sets via `DataTransfer` |
| `<input>` / `<textarea>` | `fillText` — uses native value setter to trigger React/Vue synthetic events |

**React/Vue compatibility:** Text fill uses `Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)` — the native setter — before dispatching `input` and `change` events. Using `el.value = x` directly bypasses React's internal state tracking.

**Between-field delay:** 80ms pause between each fill to allow framework state reconciliation.

**Visual feedback:** `flashFilled(el)` sets a purple outline (`#6366f1`) then transitions to green (`#6ee7b7`) over 1.5 seconds, then restores the original style.

### 4.6 GET_MATCHES API Call

```typescript
chrome.runtime.sendMessage({
  type: "GET_MATCHES",
  payload: {
    fields: allActionable.map(f => ({
      uid, kind, confidence, input_type, label, selector
    })),
    url: window.location.href,
    // job_context not sent from autofill (no JD available)
  }
});
// → background calls: POST /api/v1/autofill/match
// ← response: { matches: FieldMatch[], resume_id: string|null, resume_name: string|null }
```

`FieldMatch`: `{ uid: string, value: string, source: "rules" | "ai" }`

---

## 5. Feature 3 — Application Tracking & Pipeline

### 5.1 LOOKUP_BY_URL

Before rendering the overlay, `portal-runner.ts` sends:

```typescript
chrome.runtime.sendMessage({ type: "LOOKUP_BY_URL", payload: { url: jobData.url } })
// → background: GET /api/v1/applications/lookup?url={encoded}
// ← AppRecord | null
```

`AppRecord`:
```typescript
{
  id: string;
  company: string;
  role: string;
  status: string;          // "saved" | "applied" | "interview" | "technical" | "offer"
  applied_at: string;      // ISO timestamp
  has_resume: boolean;
  resume_id: string | null;
  ats_score: number | null;
  job_url: string | null;
}
```

If `AppRecord` is non-null, the overlay renders the tracked view. If null, it renders "Track this job."

### 5.2 Pipeline State Machine

```
saved → applied → interview → offer
          ↑           ↑
       screening   technical   (aliases: map to the same visual stage)
```

`PIPELINE_LABELS` maps backend statuses to display names:
```typescript
{ saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview", offer: "Offer" }
```

`NEXT_STATUS` defines valid transitions:
```typescript
{ saved: "applied", applied: "interview", screening: "interview",
  interview: "offer", technical: "offer" }
```

### 5.3 Advance Button

When user clicks "→ Move to Applied":
1. Button disabled, text → "Updating…"
2. `UPDATE_APP_STATUS` → `PATCH /api/v1/applications/{id}` with `{ status: nextStatus }`
3. On success: `currentApp.status = nextStatus`, `rerenderActions(currentApp)` rebuilds the pipeline HTML and re-attaches all listeners
4. Background pushes a `pushNotification` (success type, shows in popup) upon `updateAppStatus`

### 5.4 Save Job (First Track)

```
"+ Track this job" click
    → SYNC_APPLICATION → POST /api/v1/applications/
    ← { success: true, data: { id } }
    → Build local AppRecord from response + jobData (no second round-trip)
    → injectOverlay(matchScore, jobData, app)  ← re-renders with tracked view
```

On error (not signed in): shows toast with "Sign in →" action.

---

## 6. Feature 4 — Resume Tailoring Integration

### 6.1 "Tailor Resume" Button

Appears in the overlay when a job is tracked but no tailored resume exists (`has_resume === false`).

```
Click "✨ Tailor Resume"
    → OPEN_TAILOR → background.ts
    → chrome.storage.local.set({ af_tailor_prefill: { jd, company, role, applicationId } })
    → chrome.tabs.create({ url: "http://localhost:3000/resume" })
```

If not signed in, `OPEN_TAILOR` throws `"Not authenticated"` → overlay shows error toast with sign-in action.

### 6.2 prefill-bridge.ts (localhost:3000/resume*)

Runs as a content script on the web app's resume page. It bridges `chrome.storage` → web app:

```typescript
chrome.storage.local.get("af_tailor_prefill", (result) => {
  if (!result.af_tailor_prefill) return;
  chrome.storage.local.remove("af_tailor_prefill");
  // Two paths — covers both race conditions:
  sessionStorage.setItem("af_tailor_prefill", JSON.stringify(data));  // React not yet mounted
  window.dispatchEvent(new CustomEvent("af_prefill_ready", { detail: data }));  // React already mounted
});
```

The web app listens for `af_prefill_ready` and `sessionStorage.getItem("af_tailor_prefill")` on mount to pre-fill the JD editor and start tailoring.

### 6.3 Resume Saved Callback

When the web app finishes saving a tailored resume, it fires `af_resume_saved` on `window`:

```typescript
window.dispatchEvent(new CustomEvent("af_resume_saved", {
  detail: { resumeId, applicationId, company, role, jobUrl }
}));
```

`prefill-bridge.ts` catches this and:
1. Sends `NOTIFY` → stores in `af_notifications` (visible in popup)
2. Sets `af_pending_toast` in storage — a toast queued for the next time the user is on the job page

When the user returns to the job page, `flushPendingToast()` (called at the start of `runInit`) reads and shows this toast with an "Open Resume →" action.

### 6.4 "Open Resume" Button

After a tailored resume exists (`has_resume === true`, `resume_id` is set):

```
Click "Open →"
    → OPEN_RESUME → background.ts
    → chrome.storage.local.set({ af_open_resume: { resumeId, applicationId } })
    → chrome.tabs.create({ url: "http://localhost:3000/resume" })
```

`prefill-bridge.ts` reads `af_open_resume` on the resume page and fires `af_open_resume` custom event → web app loads the specific tailored resume into the editor.

---

## 7. Feature 5 — In-Page Sign-In Panel

`signin-panel.ts` provides `showSignInPanel(onSuccess?)`. It injects a 300px panel at z-index 2147483648 (above the overlay):

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

On successful sign-in:
1. `POST /api/v1/auth/login` with `{ email, password }`
2. Stores session in `chrome.storage.local`:
   ```typescript
   { session: { token, user: { id, name, email, plan, createdAt }, expiresAt } }
   ```
3. Calls `onSuccess?.()` — the callback is set by the caller (e.g., autofill reopens the panel with the now-authenticated flow)

`showSignInPanel` is called from:
- Overlay: "Track this job" error toast sign-in action
- Autofill: "Sign in to Autofill →" button in detection panel

---

## 8. Feature 6 — Popup & Notification Center

### 8.1 Authentication Flow (Popup)

`Popup.tsx` has two views:

**`AuthView`** (not signed in):
- `LoginForm` → `POST /api/v1/auth/login` → sets `chrome.storage.local { session }`
- `RegisterForm` → `POST /api/v1/auth/register` → sets session

**`DashboardView`** (signed in):
- Reads `af_notifications` from storage
- Calls `MARK_NOTIFICATIONS_READ` → clears badge text on extension icon
- Shows up to 8 recent notifications with type icon, title, body, timestamp

### 8.2 Notification System

`pushNotification(n)` in `background/index.ts`:

```typescript
// Reads existing notifications from storage
// Prepends new notification with UUID + ISO timestamp
// Keeps only last 20
// Sets chrome.action badge text to unread count (purple #6366f1 background)
```

Notification types: `success`, `error`, `info`, `warning`

Notifications that have a `resumeId` action show an "Open Resume →" button in the popup that opens the web app.

### 8.3 Extension Icon Badge

The badge text (red/purple number) on the extension icon represents unread notification count. Cleared when the popup is opened (`MARK_NOTIFICATIONS_READ`).

---

## 9. Multi-Portal Adapter System

### 9.1 Router: `job-portal.ts`

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

Note the use of `endsWith` and `includes` for portals with variable subdomains (BambooHR company subdomains, iCIMS company subdomains, all Indeed country domains, all Glassdoor country domains).

### 9.2 Per-Adapter Details

| Portal | `isJobPage()` check | Primary extraction | SPA navigation |
|---|---|---|---|
| LinkedIn | `/jobs/view/` in path OR `currentJobId` in URL | DOM (`data-job-id`, `.job-details-jobs-unified-top-card`) | URL change (history API) |
| Greenhouse | `/COMPANY/jobs/NUMERIC_ID` path pattern | JSON-LD → Boards API | None (full page load) |
| Lever | `/COMPANY/UUID` path (UUID regex) | JSON-LD → Postings API | None |
| Ashby | `/COMPANY/UUID` path (length > 20, contains dash) | JSON-LD → Board API | None |
| Indeed | `/viewjob` path OR `jk=` param OR `/jobs` + `vjk=` param | DOM (`data-testid`) | `jk`/`vjk` URL param change |
| Glassdoor | `/job-listing/` path OR `jl=`/`jobListingId=` param OR `/Job/` path + title visible | JSON-LD → DOM (`data-test`) | `jl=` param change OR title DOM change |
| Wellfound | `/jobs/ID-slug` OR `/company/slug/jobs/ID-slug` | `__NEXT_DATA__` Apollo cache → JSON-LD → DOM | None |
| SmartRecruiters | 2 path segments, 2nd starts with digit | JSON-LD → DOM (`data-qa`) | None |
| Workable | `/COMPANY/j/SHORTCODE` (middle segment = "j") | JSON-LD → DOM (`data-ui`) | None |
| BambooHR | `/careers/ID` OR `/jobs/view.php?id=` | DOM (`BambooHR-ATS-` class prefix) | None |
| Jobvite | path contains `/job/JOBID` | JSON-LD → DOM (`jv-` class prefix) | None |
| iCIMS | `/jobs/NUMERIC_ID/job` path | JSON-LD → DOM (`iCIMS_` prefix) → iframe fetch → title tag | None |

---

## 10. Background Service Worker

`background/index.ts` is a Manifest V3 service worker (not a persistent background page). All API calls from content scripts go through it via `chrome.runtime.sendMessage`.

### 10.1 Auth Helper: `authedFetch`

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

### 10.2 Message Handlers

| Message type | Handler | API call |
|---|---|---|
| `ANALYZE_JOB` | `analyzeJob` | `POST /api/v1/ai/match` |
| `GET_SESSION` | reads storage | no API call |
| `SYNC_APPLICATION` | `syncApplication` | `POST /api/v1/applications/` |
| `OPEN_TAILOR` | `openTailorTab` | sets storage, opens tab |
| `OPEN_RESUME` | `openResumeTab` | sets storage, opens tab |
| `CHECK_APPLICATION` | `checkApplication` | `GET /api/v1/applications/check?company=&role=` |
| `LOOKUP_BY_URL` | `lookupByUrl` | `GET /api/v1/applications/lookup?url=` |
| `UPDATE_APP_STATUS` | `updateAppStatus` | `PATCH /api/v1/applications/{id}` |
| `GET_PROFILE` | `getProfile` | `GET /api/v1/profile/` |
| `GET_MATCHES` | `getMatches` | `POST /api/v1/autofill/match` |
| `GET_RESUME_PDF` | `getResumePdfBytes` | `GET /api/v1/resumes/{id}/pdf-bytes` |
| `NOTIFY` | `pushNotification` | updates storage + badge |
| `MARK_NOTIFICATIONS_READ` | `markAllRead` | updates storage + clears badge |
| `SAVE_LEARNED_FIELDS` | `saveLearnedFields` | `PATCH /api/v1/profile/learned-fields` |

---

## 11. Chrome Storage Schema

All keys in `chrome.storage.local`:

| Key | Type | Set by | Read by | Purpose |
|---|---|---|---|---|
| `session` | `{ token, user, expiresAt }` | Popup / signin-panel | background (all auth'd calls) | JWT auth token + user info |
| `af_notifications` | `AppNotification[]` (max 20) | background `pushNotification` | Popup DashboardView | Notification history |
| `af_pending_toast` | `{ type, title, body, action? }` | prefill-bridge (af_resume_saved) | portal-runner `flushPendingToast` | Toast queued for next job page visit |
| `af_tailor_prefill` | `{ jd, company, role, applicationId? }` | background `openTailorTab` | prefill-bridge | Job data for resume tailor page |
| `af_open_resume` | `{ resumeId, applicationId }` | background `openResumeTab` / popup | prefill-bridge | Resume to open in editor |
| `af_last_fill` | `{ items, url, timestamp }` | autofill.ts after fill | (debug / future use) | Last autofill run record |

---

## 12. Message Protocol

All messages follow the `ExtensionMessage` discriminated union from `@applyflow/shared`:

```typescript
type ExtensionMessage =
  | { type: "ANALYZE_JOB";          payload: LinkedInJobData }
  | { type: "GET_SESSION" }
  | { type: "SYNC_APPLICATION";     payload: { jobData: LinkedInJobData; status: string } }
  | { type: "OPEN_TAILOR";          payload: { jd: string; company: string; role: string; applicationId?: string } }
  | { type: "OPEN_RESUME";          payload: { resumeId: string; applicationId: string } }
  | { type: "CHECK_APPLICATION";    payload: { company: string; role: string } }
  | { type: "LOOKUP_BY_URL";        payload: { url: string } }
  | { type: "UPDATE_APP_STATUS";    payload: { id: string; status: string } }
  | { type: "GET_PROFILE" }
  | { type: "GET_MATCHES";          payload: { fields: unknown[]; url: string; job_context?: string } }
  | { type: "GET_RESUME_PDF";       payload: { resumeId: string } }
  | { type: "NOTIFY";               payload: Omit<AppNotification, "id" | "timestamp" | "read"> }
  | { type: "MARK_NOTIFICATIONS_READ" }
  | { type: "SAVE_LEARNED_FIELDS";  payload: { fields: Record<string, string> } };
```

All handlers return `true` from `onMessage` to signal async response.

---

## 13. Build System

Built with **Vite 5** using a custom `vite.config.ts` that:
- Outputs to `dist/`
- Copies `manifest.json` and icon assets unchanged
- Bundles each content script as a separate ES module chunk (no single bundle)
- The manifest references source paths (`src/content/linkedin.ts`); Vite resolves and rewrites them to the hashed output filenames in `dist/manifest.json`

**Loader pattern:** Each content script entry (e.g. `linkedin.ts-loader.js`) is a tiny stub that dynamically imports the actual bundle, sidestepping Manifest V3's module type restrictions on content scripts in older Chrome versions.

**Build command:** `npm run build` → `vite build` → outputs `dist/` — load as unpacked extension in Chrome.

---

## 14. Data Flow Diagrams

### 14.1 Job Page → Overlay

```
User opens wellfound.com/jobs/123-product-manager
            │
            ▼
Chrome injects job-portal.ts (matches manifest pattern wellfound.com/jobs/*)
            │
            ▼
job-portal.ts: hostname === "wellfound.com" → wellfoundAdapter
            │
            ▼
runPortal(wellfoundAdapter)
    ├── runInit() immediately
    │       ├── isJobPage(): parts[0]==="jobs" && /^\d/.test(parts[1]) → true
    │       ├── wait 1500ms
    │       ├── scrapeJobData():
    │       │       ├── extractFromNextData() → found in __NEXT_DATA__ Apollo cache
    │       │       └── return { title, company, description, location, url }
    │       │
    │       ├── →[msg] LOOKUP_BY_URL  →  background  →  GET /api/v1/applications/lookup?url=...
    │       │   ←[msg] AppRecord | null
    │       │
    │       ├── →[msg] ANALYZE_JOB   →  background  →  POST /api/v1/ai/match
    │       │   ←[msg] { overall_score: 78 }
    │       │
    │       └── injectOverlay(78, jobData, existingRecord)
    │               → renders panel with score ring + actions
    │
    └── wellfoundAdapter has no watchNavigation → skip
```

### 14.2 Autofill: Badge → Fill → Learn

```
User opens greenhouse.io/jobs/123 (Easy Apply form)
            │
            ▼
autofill.ts loads, MutationObserver starts (600ms debounce)
            │
            ▼
run() → scanFields(document) → [email, phone, full_name, linkedin, work_auth, resume_file]
    → fieldsKey = "input#email|input[name=phone]|..."
    → not in dismissedKeys → show badge
            │
            ▼
User clicks badge → openPanel(fields)
    → GET_SESSION → session exists → loggedIn = true
    → renderDetectionPanel(fields, true, onMatch, onClose)
            │
User clicks "Match & Review 6 fields →"
            │
            ▼
renderLoadingPanel("Matching your profile…")
→[msg] GET_MATCHES → background → POST /api/v1/autofill/match
←[msg] { matches: [{uid, value, source}, ...], resume_id: "abc", resume_name: "Resume v3" }
            │
            ▼
renderReviewSidebar(fields, matches, "abc", "Resume v3", onFill, onClose)
    Shows pre-filled inputs; user edits "years_experience" from "5" to "6"
            │
User clicks "Fill 6 fields →"
            │
            ▼
renderLoadingPanel("Filling fields…")
→ fillFields(confirmed, "abc")
    ├── input#email       → fillText("john@example.com")     ✓ flash purple→green
    ├── input[name=phone] → fillText("+1 555 0100")          ✓
    ├── input#fullName    → fillText("John Doe")             ✓
    ├── select#workAuth   → fillSelect("Yes")                ✓
    ├── input[type=file]  → fillResumeFile("abc")
    │       →[msg] GET_RESUME_PDF → background → GET /api/v1/resumes/abc/pdf-bytes
    │       ←[msg] { pdf_bytes: "JVBERi0x..." }
    │       → new File([bytes], "resume.pdf") → DataTransfer → el.files = dt.files  ✓
    └── (years_experience unknown-kind, AI source) → fillText("6")  ✓
            │
            ▼
renderSuccessPanel(filled=6, skipped=0, learnedItems=[{label:"Years of Exp", value:"6"}])
            │
User clicks "Save to Profile"
→[msg] SAVE_LEARNED_FIELDS → background → PATCH /api/v1/profile/learned-fields
→ finishFill(): lastFilledKey = fieldsKey, waitingForNextStep = true, closeAll()
```

### 14.3 Track → Tailor → Return Toast

```
User clicks "+ Track this job"
    →[msg] SYNC_APPLICATION → POST /api/v1/applications/
    ←  { success: true, data: { id: "app_xyz" } }
    → injectOverlay re-renders with tracked view
    → background fires pushNotification("Job tracked!")
    → extension icon badge shows "1"

User clicks "✨ Tailor Resume"
    →[msg] OPEN_TAILOR → background
    → storage.set({ af_tailor_prefill: { jd, company, role, applicationId: "app_xyz" } })
    → chrome.tabs.create("http://localhost:3000/resume")

On localhost:3000/resume — prefill-bridge.ts runs:
    → storage.get("af_tailor_prefill") → found → remove from storage
    → sessionStorage.setItem("af_tailor_prefill", ...)
    → window.dispatchEvent(new CustomEvent("af_prefill_ready", { detail }))
    [Web app picks up the event, pre-fills editor with JD, starts tailoring]

User saves tailored resume in web app:
    → window.dispatchEvent(new CustomEvent("af_resume_saved", { detail: { resumeId: "res_1", ... } }))
    prefill-bridge.ts catches it:
    →[msg] NOTIFY → background → pushNotification("Resume saved!", action: open_resume)
    → storage.set({ af_pending_toast: { ... } })

User closes tab, returns to job page:
    runInit() runs → flushPendingToast()
    → storage.get("af_pending_toast") → found → remove
    → showToast("success", "Resume ready! ✓", "Wellfound · Product Manager", { label: "Open Resume →", onClick: OPEN_RESUME })
```

---

## 15. Backend & Database

### 15.1 Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (mapped columns, `Mapped[]` type annotations) |
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

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

`expire_on_commit=False` — SQLAlchemy by default expires all loaded objects after a commit, which would require a second DB round-trip to re-access them. Disabled here since all endpoints return the data immediately after flush/commit.

Default `DATABASE_URL`: `postgresql+asyncpg://postgres:postgres@localhost:5432/applyflow`

---

### 15.2 Database Schema

#### Table: `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, default `uuid4()` | |
| `name` | `VARCHAR(255)` | NOT NULL | |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE, indexed | Login key |
| `hashed_password` | `VARCHAR(255)` | NOT NULL | bcrypt hash |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()`, on update `now()` | |

**Relationships:** one-to-many → `resumes`, `applications`; one-to-one → `user_profiles`

---

#### Table: `user_profiles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users.id` CASCADE DELETE, UNIQUE | One profile per user |
| `data` | `JSONB` | NOT NULL, default `{}` | All profile fields in one blob |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()`, on update `now()` | |

**Design rationale:** Profile data is stored as a single JSONB blob instead of normalised columns. This means adding new profile fields (new EEO questions, new autofill fields) requires zero schema migrations — just update the application code and the default dict.

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

`learned_fields` is a sub-map inside `data` — keys are normalised form-field labels (lowercase trimmed), values are the answers the user confirmed during a past autofill session. These are used as a "rules" source in the autofill match pipeline (confidence 0.8, shown as "Profile" badge in the review sidebar).

---

#### Table: `resumes`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users.id` NOT NULL | |
| `type` | `VARCHAR(20)` | NOT NULL, default `"base"` | `"base"` or `"tailored"` |
| `name` | `VARCHAR(255)` | nullable | Human-readable label |
| `filename` | `VARCHAR(255)` | nullable | Original upload filename (base only) |
| `content` | `TEXT` | nullable | Extracted plain text from upload (base only) |
| `tailored_content` | `JSONB` | nullable | Full AI-generated resume JSON (tailored only) |
| `application_id` | `UUID` | FK → `applications.id` SET NULL on delete, indexed, nullable | Links tailored resume to a job |
| `ats_score` | `INTEGER` | nullable | ATS score from AI (0–100) |
| `pdf_bytes` | `TEXT` | nullable | base64-encoded PDF for extension file upload |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()`, on update `now()` | |

**`tailored_content` JSONB schema** (output of `/api/v1/ai/tailor`):
```json
{
  "name": "John Doe",
  "contact": { "email": "...", "phone": "...", "location": "...", "linkedin": "..." },
  "summary": "Tailored 2–3 sentence summary",
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Software Engineer",
      "duration": "Jan 2022 – Present",
      "bullets": ["Led migration...", "Built..."]
    }
  ],
  "education": [{ "institution": "MIT", "degree": "BS CS", "year": "2020" }],
  "skills": ["Python", "React"],
  "keywords_added": ["TypeScript", "System Design"],
  "ats_score": 87
}
```

**Type duality:** A single `resumes` table stores both base (uploaded) and tailored (AI-generated) resumes, distinguished by the `type` column. Base resumes have `content` set and `tailored_content` null; tailored resumes have `tailored_content` set and `content` null.

**PDF bytes:** When the user saves a tailored resume from the web editor, the frontend renders the resume to PDF, base64-encodes it, and sends it in the save request. The extension reads `pdf_bytes` via `GET_RESUME_PDF` to attach the file to upload fields in application forms.

---

#### Table: `applications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users.id` NOT NULL | |
| `company` | `VARCHAR(255)` | NOT NULL | |
| `role` | `VARCHAR(255)` | NOT NULL | |
| `job_url` | `VARCHAR(2048)` | nullable | Canonical job page URL — used for extension lookup |
| `job_description` | `TEXT` | nullable | Full JD text scraped by extension |
| `notes` | `TEXT` | nullable | User notes |
| `status` | `VARCHAR(50)` | NOT NULL, default `"saved"` | Pipeline stage |
| `applied_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()`, on update `now()` | |

**Status values:** `saved` → `applied` / `screening` → `interview` / `technical` → `offer` / `rejected`

The extension only uses `saved`, `applied`, `interview`, `offer`. `screening` and `technical` are aliases that map to the same pipeline visual stage.

**Relationships:** many-to-one → `users`; one-to-one (optional) → `resumes` (via `resumes.application_id`)

---

### 15.3 Entity Relationship Diagram

```
users
  │  id (PK)
  │  email (UNIQUE, indexed)
  │  hashed_password
  │
  ├──< user_profiles (1:1)
  │       id (PK)
  │       user_id (FK → users.id, UNIQUE, CASCADE DELETE)
  │       data (JSONB) — all profile fields + learned_fields
  │
  ├──< applications (1:many)
  │       id (PK)
  │       user_id (FK → users.id)
  │       company, role, job_url, job_description, status
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

### 15.4 Alembic Migrations

4 migrations in order:

| Revision | Description |
|---|---|
| `73f1526e6c2c` | Initial — creates `users`, `applications` (no `job_url`), `resumes` (base only, no `type`/`tailored_content`) |
| `b3e8f2a1c9d7` | Adds `resumes.type`, `resumes.tailored_content` (JSONB), `resumes.application_id` (FK), `resumes.ats_score`, `applications.job_url`, `applications.notes`, makes `resumes.filename`/`content` nullable |
| `c4a7d1e8f302` | Adds `user_profiles` table with `data` JSONB blob |
| `d5f3a2b8e1c9` | Adds `resumes.pdf_bytes` (TEXT, nullable) and `resumes.name` (VARCHAR 255) |

Run migrations: `alembic upgrade head`

---

### 15.5 Authentication

**Registration** (`POST /api/v1/auth/register`):
1. Check email uniqueness (`SELECT WHERE email = ?`)
2. `bcrypt.hashpw(password, gensalt())` — bcrypt with random salt
3. INSERT into `users`
4. Return JWT: `{"sub": user_id, "exp": now + 24h}` signed with `SECRET_KEY` (HS256)

**Login** (`POST /api/v1/auth/login`):
1. `SELECT WHERE email = ?`
2. `bcrypt.checkpw(password, hashed_password)`
3. Return same JWT structure

**JWT validation (`core/deps.py`):**
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("sub")
    user = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    return user.scalar_one_or_none()
```

Every protected endpoint injects `current_user: User = Depends(get_current_user)`. Auto-logout on 401: the extension's `authedFetch` calls `chrome.storage.local.remove("session")` on any 401 response.

---

### 15.6 API Endpoints Reference

All routes are prefixed `/api/v1`. All except `/auth/login` and `/auth/register` require `Authorization: Bearer <token>`.

#### Auth (`/auth`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| POST | `/login` | SELECT users WHERE email | Returns JWT |
| POST | `/register` | INSERT users | Returns JWT, 409 if email taken |
| GET | `/me` | none (token payload) | Returns current user info |

#### Applications (`/applications`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| GET | `/` | SELECT all WHERE user_id, ORDER BY applied_at DESC | Eagerly loads `tailored_resume` |
| POST | `/` | INSERT | Saves job from extension |
| GET | `/{id}` | SELECT WHERE id AND user_id | Full detail including JD |
| PATCH | `/{id}` | UPDATE partial fields | Used by overlay advance button |
| DELETE | `/{id}` | DELETE | |
| GET | `/lookup?url=` | SELECT WHERE user_id AND job_url | Extension LOOKUP_BY_URL check |
| GET | `/check?company=&role=` | SELECT WHERE user_id AND LOWER(company) AND LOWER(role) | Case-insensitive match |

#### Resumes (`/resumes`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| GET | `/` | SELECT all WHERE user_id | List view (no content/tailored_content) |
| GET | `/base` | SELECT WHERE user_id AND type="base" ORDER BY created_at DESC LIMIT 1 | Used as AI tailoring input |
| POST | `/upload` | INSERT type="base" | Parses PDF/DOCX/TXT, stores extracted text |
| POST | `/tailored` | UPSERT — UPDATE if `application_id` + `type=tailored` exists, else INSERT | Idempotent save from editor |
| PUT | `/{id}` | UPDATE tailored_content / name / pdf_bytes | Editor Save button |
| GET | `/{id}` | SELECT WHERE id AND user_id | Full detail |
| GET | `/{id}/pdf-bytes` | SELECT pdf_bytes WHERE id AND user_id | Extension file upload |
| DELETE | `/{id}` | DELETE | |

#### Profile (`/profile`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| GET | `/` | SELECT user_profiles WHERE user_id | Merges with `_default_profile()` |
| PUT | `/` | UPSERT user_profiles | Full replace of data blob |
| PUT | `/name` | UPDATE users.name | |
| POST | `/import-resume` | SELECT resumes + Claude API call | Extracts structured data from resume text |
| PATCH | `/learned-fields` | UPDATE user_profiles.data.learned_fields | Merges new learned answers into existing map |

#### AI (`/ai`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| POST | `/match` | none (stub) | Returns hardcoded score 75; real scoring TBD |
| POST | `/tailor` | SELECT resumes + SELECT applications | Streams Claude response (SSE) |
| POST | `/chat` | none | Streams Claude career coach response (SSE) |

#### Autofill (`/autofill`)

| Method | Path | DB operation | Notes |
|---|---|---|---|
| POST | `/match` | SELECT user_profiles + SELECT applications + SELECT resumes | Rules pass → learned fields → Claude AI pass |

---

### 15.7 Autofill Match Pipeline (Backend)

`POST /api/v1/autofill/match` is the most complex endpoint. It runs in two sequential passes:

**Pass 1 — Rules matcher** (`_rules_match`):

Maps each field `kind` to a profile value using a lookup table. No AI cost.

```
email          → current_user.email
full_name      → current_user.name
first_name     → name.split()[0]
last_name      → " ".join(name.split()[1:])
phone          → profile["phone"]
location       → profile["location"]
city           → location.split(",")[0]
state          → location.split(",")[1]
country        → location.split(",")[2]
linkedin       → profile["linkedin"]
github         → profile["github"]
website        → profile["website"]
headline       → profile["headline"]
work_auth      → profile["work_authorization"]
requires_sponsorship → "Yes" if profile["requires_sponsorship"] else "No"
salary         → "{currency} {min:,} – {max:,}"
years_experience → str(profile["years_experience"])
notice_period  → profile["notice_period"]
remote_preference → profile["remote_preference"]
willing_to_relocate → "Yes" / "No"
gender/ethnicity/disability/veteran → EEO profile fields
resume_file    → null (handled by fill engine, not text value)
summary/unknown → queued for Pass 2
```

**Learned fields check** (between passes): For `unknown` kind fields, the normalised label is looked up in `profile["learned_fields"]`. If found, uses that value with `source="rules"`, `confidence=0.8`. This avoids an AI call for questions the user has answered before.

**Pass 2 — AI matcher** (`_ai_match`): One Claude call for all remaining `summary` and `unknown` fields. Sends a profile context (name, headline, summary, top 3 experiences, skills) + list of `{uid, label, kind}` tuples. Returns a JSON map `{uid: value | null}`. `source="ai"` for any field where a value is returned.

**Resume resolution for file upload:** After both passes, looks up the `application` by `job_url`, then finds the linked `tailored` resume with non-null `pdf_bytes`. Returns `resume_id` and `resume_name` in the response so the extension can pre-select the correct resume for the file upload field.

---

### 15.8 AI Integration

All AI calls use `settings.ANTHROPIC_API_KEY` and `settings.DEFAULT_AI_MODEL` (`claude-sonnet-4-6`).

| Endpoint | Claude usage | Streaming |
|---|---|---|
| `POST /ai/tailor` | Full resume rewrite — sends base resume text + JD, returns structured JSON | Yes (SSE `data: {"chunk": "..."}`) |
| `POST /ai/chat` | Career coach — open-ended Q&A | Yes (SSE) |
| `POST /profile/import-resume` | Extract structured profile from resume text | No (sync) |
| `POST /autofill/match` | Fill `summary`/`unknown` form fields from profile context | No (sync) |

**Streaming format** (`/ai/tailor`, `/ai/chat`):
```
data: {"chunk": "{\n  \"name\":"}
data: {"chunk": " \"John Doe\","}
...
data: [DONE]
```

The web app accumulates chunks and JSON-parses when `[DONE]` is received.

---

### 15.9 Configuration (`core/config.py`)

All settings are loaded from `.env` via pydantic-settings:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/applyflow` | Async PostgreSQL DSN |
| `REDIS_URL` | `redis://localhost:6379` | Reserved for future session/cache use |
| `SECRET_KEY` | `"CHANGE_ME_IN_PRODUCTION"` | JWT signing key — must be changed in prod |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) | JWT lifetime |
| `ANTHROPIC_API_KEY` | `""` | Required for AI features |
| `DEFAULT_AI_MODEL` | `claude-sonnet-4-6` | Claude model for all AI calls |
| `DEBUG` | `false` | Enables SQLAlchemy query logging when true |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed origins for CORS |

---

## 16. Engineering Roadmap — Production-Grade Architecture

> **Objective:** Transition from "feature-rich extension" → "production-grade resilient platform."
>
> The current architecture is solid. These changes standardize runtime behavior across all portals, add submission verification, lifecycle tracking, and observability — without rewriting what already works.

---

### 16.1 Architectural Layer Model

#### Current (3 layers)

```
Portal Adapter
      ↓
portal-runner.ts
      ↓
overlay.ts
```

#### Target (7 layers)

```
Portal Adapter Layer          — thin, portal-specific signals only
        ↓
Runtime Orchestration Layer   — retries, state transitions, triggers
        ↓
Extraction + Validation Layer — normalization, confidence scoring
        ↓
Fingerprint + Tracking Layer  — canonical ID, dedup, URL normalization
        ↓
Submission Detection Layer    — network + redirect + DOM signals
        ↓
Lifecycle Verification Layer  — active / expired / closed / reposted
        ↓
Persistence + Notification    — storage, backend sync, toast/notification
```

**Core principle:** Every portal emits *different signals*, but runtime behavior must be *standardized*. Adapters supply the signals. Everything else is shared.

---

### 16.2 What Stays in Adapters vs What Moves to Shared Layers

#### Adapters keep (portal-specific only):

| Concern | Stays in adapter |
|---|---|
| DOM selectors | ✅ |
| ATS public API endpoints | ✅ |
| `isJobPage()` URL pattern | ✅ |
| Portal quirks (iCIMS iframe, Glassdoor SPA title-watch) | ✅ |
| Raw extraction signals | ✅ |

#### Moves to shared layers:

| Concern | New home |
|---|---|
| Retries and timeouts | `runtime/runtime-manager.ts` |
| DOM stabilization wait | `runtime/dom-stability.ts` |
| SPA navigation detection | `runtime/navigation-manager.ts` |
| Session continuity across reloads | `runtime/session-manager.ts` |
| Job fingerprinting | `tracking/fingerprint.ts` |
| Submission detection | `submission/submission-detector.ts` |
| Lifecycle status | `lifecycle/lifecycle-engine.ts` |
| Overlay rendering | already in `shared/overlay.ts` ✅ |
| Telemetry | `telemetry/tracker.ts` |

---

### 16.3 Runtime Orchestration Layer

**New directory:** `src/content/runtime/`

```
runtime/
  runtime-manager.ts    ← orchestration, retries, state machine
  dom-stability.ts      ← hydration wait, debounce
  navigation-manager.ts ← SPA URL + history API hooks
  session-manager.ts    ← active apply session, reload recovery
```

#### `dom-stability.ts`

Replaces the current hardcoded `await new Promise(r => setTimeout(r, 1500))` in `portal-runner.ts` with an intelligent wait:

```typescript
// Current approach (dumb):
await new Promise((r) => setTimeout(r, 1500));

// Target approach (smart):
await waitForStableDOM({
  stableWindow: 600,       // ms of no DOM mutations = "stable"
  timeout: 5000,           // max wait before giving up
  minDescriptionLength: 300 // optional: wait until job description has substance
});
```

**Implementation:** `waitForStableDOM` starts a MutationObserver. Every mutation resets a debounce timer. When the timer fires (no mutations for `stableWindow` ms), resolve. If `timeout` is reached first, resolve anyway (graceful degradation). If `minDescriptionLength` is set, additionally wait until a description-like element reaches that text length.

**Why this matters:** The current 1500ms is a guess. Fast connections over-wait; slow corporate SSO flows under-wait, causing empty scrapes.

#### `navigation-manager.ts`

Centralizes all SPA navigation detection currently scattered across adapter `watchNavigation()` implementations:

```typescript
// Current: each adapter implements its own watchNavigation
// Target: NavigationManager provides standardized hooks

export class NavigationManager {
  // URL param change (Indeed vjk/jk, Glassdoor jl)
  watchUrlParams(keys: string[], onChange: () => void): void;

  // Pushstate / replaceState (LinkedIn, Wellfound)
  watchHistoryApi(onChange: () => void): void;

  // DOM text change in a specific element (Glassdoor India)
  watchDomChange(selector: string, onChange: () => void): void;
}
```

Adapters declare which strategy they need; NavigationManager handles the actual observation and deduplication.

#### `session-manager.ts`

Persists apply-session state keyed by Chrome tab ID, surviving page reloads and redirects:

```typescript
// Storage key: af_active_session_{tabId}

type ActiveSession = {
  applicationId: string;
  fingerprintHash: string;
  portal: string;
  startedAt: string;        // ISO timestamp
  currentStage: string;     // "viewing" | "applying" | "submitted"
  tabId: number;
};
```

**Use case:** User clicks "Apply" on LinkedIn → redirected to external Greenhouse form. The session persists across the redirect. When `autofill.ts` loads on the Greenhouse page, it reads the session and knows which `applicationId` to associate the fill with. On successful submission detection, the session is resolved and deleted.

#### `runtime-manager.ts`

State machine governing the full lifecycle of a page visit:

```
IDLE
  → isJobPage() = true → DETECTED
  → waitForStableDOM() resolves → STABLE
  → scrapeJobData() succeeds → EXTRACTED
  → LOOKUP_BY_URL + ANALYZE_JOB complete → READY
  → injectOverlay() → DISPLAYED
  → watchNavigation fires → IDLE (new job)
  → submission detected → APPLIED
```

Adds retry logic around scraping (up to 3 attempts with 1s backoff) before giving up and reporting a telemetry event.

---

### 16.4 Canonical Job Fingerprinting

**New file:** `src/content/tracking/fingerprint.ts`

#### Problem

The same job can appear at multiple URLs:
- LinkedIn redirect → `greenhouse.io` direct link
- Job reposted with new `jl=` param on Glassdoor
- Indeed `viewjob?jk=X` vs `/jobs?vjk=X`

The current system uses `job_url` as the sole identity key, causing duplicate tracking records.

#### Fingerprint Type

```typescript
type JobFingerprint = {
  portal: string;                // "greenhouse" | "linkedin" | ...
  canonicalUrl: string;          // normalized, param-stripped URL
  externalJobId?: string;        // ATS-native ID where available
  normalizedCompany: string;     // lowercase, punctuation stripped
  normalizedTitle: string;       // lowercase, seniority-normalized
  normalizedLocation?: string;   // city, country only
  hash: string;                  // SHA-256(portal + externalJobId OR company + title + location)
};
```

#### Fingerprint Resolution Strategy (priority order)

```
1. externalJobId (most stable — from ATS API or URL segment)
        ↓
2. canonicalUrl (stable if portal doesn't rotate URLs)
        ↓
3. SHA-256(normalizedCompany + normalizedTitle + normalizedLocation)
   (fallback for portals without stable IDs)
```

**Normalization rules:**
- Company: lowercase, strip `Inc`, `LLC`, `Ltd`, `Co.`, leading `the`
- Title: lowercase, strip `Senior`/`Sr.`/`Junior`/`Jr.`/`Staff`/`Principal`, normalize `swe`→`software engineer`
- Location: extract city + country only, drop zip/state for remote-friendly roles

#### Database Changes (applications table)

```sql
ALTER TABLE applications ADD COLUMN fingerprint_hash VARCHAR(64);
ALTER TABLE applications ADD COLUMN portal VARCHAR(50);
ALTER TABLE applications ADD COLUMN external_job_id VARCHAR(255);
ALTER TABLE applications ADD COLUMN canonical_url VARCHAR(2048);

-- Indexes
CREATE INDEX ix_applications_fingerprint ON applications (fingerprint_hash);
CREATE UNIQUE INDEX ix_applications_user_fingerprint
  ON applications (user_id, fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;
```

`LOOKUP_BY_URL` endpoint upgrades to try `fingerprint_hash` first (dedup), fall back to `job_url` for legacy records.

---

### 16.5 Submission Detection Engine

**New directory:** `src/content/submission/`

```
submission/
  submission-detector.ts  ← orchestrator
  network-detector.ts     ← XHR/fetch interception
  success-detector.ts     ← redirect + DOM signals
```

#### Multi-Signal Detection with Confidence Scores

| Signal | Confidence | Implementation |
|---|---|---|
| Network POST to known ATS endpoint succeeds (2xx) | 0.95 | Intercept `XMLHttpRequest` and `fetch` via monkey-patch |
| Redirect to `/application-submitted`, `/thank-you`, etc. | 0.75 | `navigation-manager.ts` URL change watch |
| Success DOM text detected | 0.45 | MutationObserver on `document.body` |

**Rule:** Automatically advance `saved → applied` when cumulative confidence ≥ 0.85.

#### Known ATS Submit Endpoints

| Portal | Endpoint pattern | Method |
|---|---|---|
| Greenhouse | `/applications` | POST |
| Lever | `/candidates` | POST |
| Workable | `/apply` | POST |
| Ashby | `/submit` | POST |
| iCIMS | `/apply/submit` | POST |
| BambooHR | `/jobs/*/apply` | POST |

#### `network-detector.ts` — XHR/Fetch Interception

```typescript
// Monkey-patch fetch before page scripts run (injected at document_start)
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const res = await originalFetch(input, init);
  const url = typeof input === "string" ? input : input.url;
  if (isKnownSubmitEndpoint(url) && res.ok) {
    onSubmissionDetected({ signal: "network", confidence: 0.95, url });
  }
  return res;
};
```

XHR patched similarly via `XMLHttpRequest.prototype.open` + `send`.

#### `success-detector.ts` — DOM + Redirect Signals

```typescript
// Success text patterns
const SUCCESS_PATTERNS = [
  /application submitted/i,
  /thank you for applying/i,
  /we.{0,10}received your application/i,
  /you.ve applied/i,
  /successfully applied/i,
];

// Redirect URL patterns
const SUCCESS_URL_PATTERNS = [
  /\/application-submitted/,
  /\/thank-you/,
  /\/confirmation/,
  /\/success/,
  /applied=true/,
];
```

#### On Detection

```typescript
// confidence threshold met → auto-advance pipeline
if (totalConfidence >= 0.85) {
  chrome.runtime.sendMessage({
    type: "UPDATE_APP_STATUS",
    payload: { id: session.applicationId, status: "applied" }
  });
  sessionManager.resolve(tabId);
  showToast("success", "Application submitted!", "Automatically marked as Applied.");
}
```

---

### 16.6 Lifecycle Verification Engine

**New directory:** `src/content/lifecycle/`

Tracks whether a job posting is still active, independently of the user's pipeline stage.

#### Lifecycle Status (separate from user pipeline)

```
User pipeline:  saved → applied → interview → offer
Job lifecycle:  active | expired | closed | removed | reposted | unknown
```

These are stored separately — a job can be `applied` (user pipeline) + `removed` (job lifecycle) simultaneously.

#### Database Changes

```sql
ALTER TABLE applications ADD COLUMN lifecycle_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE applications ADD COLUMN lifecycle_checked_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN lifecycle_expires_at TIMESTAMPTZ;

ALTER TABLE applications ADD COLUMN ats_metadata JSONB;
-- ats_metadata schema:
-- {
--   "portal": "greenhouse",
--   "externalJobId": "12345",
--   "companySlug": "acme-corp",
--   "verificationConfidence": 0.9,
--   "signals": ["json_ld_present", "apply_button_active"],
--   "fetchedAt": "2026-05-27T..."
-- }
```

#### New Tables

**`job_observations`** — snapshot history per job visit:

```sql
CREATE TABLE job_observations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifecycle_status VARCHAR(20) NOT NULL,
  page_hash   VARCHAR(64),         -- hash of visible job content (detect edits)
  title       VARCHAR(255),
  company     VARCHAR(255),
  signals     JSONB                -- raw detection signals
);
CREATE INDEX ix_job_observations_application ON job_observations (application_id);
CREATE INDEX ix_job_observations_user_time ON job_observations (user_id, observed_at DESC);
```

**`job_lifecycle_events`** — state transition audit log:

```sql
CREATE TABLE job_lifecycle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,  -- "expired" | "closed" | "reposted" | "reopened"
  previous_status VARCHAR(20),
  new_status      VARCHAR(20),
  confidence      FLOAT,
  source          VARCHAR(50),           -- "dom" | "http" | "json_ld" | "background_check"
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB
);
CREATE INDEX ix_lifecycle_events_application ON job_lifecycle_events (application_id);
```

**`portal_telemetry_events`** — observability:

```sql
CREATE TABLE portal_telemetry_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal           VARCHAR(50) NOT NULL,
  event_type       VARCHAR(100) NOT NULL,  -- "scrape_failed" | "selector_miss" | ...
  url              TEXT,
  selector         TEXT,
  error_message    TEXT,
  extension_version VARCHAR(20),
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata         JSONB
);
CREATE INDEX ix_telemetry_portal_type ON portal_telemetry_events (portal, event_type);
CREATE INDEX ix_telemetry_time ON portal_telemetry_events (occurred_at DESC);
```

#### Multi-Signal Closure Detection

When `portal-runner.ts` (via runtime-manager) visits a job page, it checks:

| Signal | How detected | Indicates |
|---|---|---|
| HTTP 404 on `job_url` | Background fetch | Removed |
| HTTP 410 on `job_url` | Background fetch | Permanently removed |
| HTTP 302 redirect away | Follow redirect | Likely expired |
| DOM text contains `"job expired"` / `"applications closed"` / `"no longer accepting"` | Text scan | Expired/closed |
| Apply button `disabled` / `hidden` / absent | DOM query | Closed |
| JSON-LD `JobPosting` block absent (was previously present) | Compare vs last observation | Closed/removed |

---

### 16.7 Background Revalidation System

**New backend endpoint:** `POST /api/v1/jobs/revalidate`

Runs on a schedule (cron or task queue) to re-check tracked jobs the user hasn't visited recently.

#### Revalidation Frequency

| Job age | Check frequency |
|---|---|
| 0–7 days | Every 12 hours |
| 7–30 days | Daily |
| 30+ days | Weekly |

#### Flow

```
backend scheduler (APScheduler / Celery)
        ↓
fetch applications WHERE lifecycle_status = "active"
  AND lifecycle_checked_at < (now - threshold)
        ↓
for each application:
  HEAD {job_url}  →  check HTTP status
  GET {job_url}   →  parse DOM / JSON-LD (headless or plain HTTP)
        ↓
update lifecycle_status + lifecycle_checked_at
        ↓
if changed → INSERT job_lifecycle_events
           → notify user (NOTIFY message → popup badge)
```

**Note:** Full headless browser rendering is expensive. For Phase 1, use plain HTTP HEAD/GET. For ATS portals with APIs (Greenhouse, Lever, Ashby), query the API directly — much cheaper than HTML parsing.

---

### 16.8 Declarative Adapter Config Format

**Goal:** Reduce imperative adapter code. Move toward a config-first format that the shared runtime can interpret.

#### Current adapter (imperative):

```typescript
export const greenhouseAdapter: JobPortalAdapter = {
  portalName: "Greenhouse",
  isJobPage() { return /^\/\w+\/jobs\/\d+/.test(location.pathname); },
  async scrapeJobData() {
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };
    // ... API call fallback ...
  }
};
```

#### Target adapter (declarative + thin imperative escape hatch):

```typescript
export const greenhouseAdapter: JobPortalAdapter = {
  portal: "greenhouse",

  capabilities: {
    supportsSPA: false,
    supportsJsonLd: true,
    supportsPublicApi: true,
    supportsSubmissionTracking: true,
    submissionEndpoint: "/applications",
  },

  urlPattern: /^\/\w+\/jobs\/\d+/,  // replaces isJobPage()

  selectors: {
    title:       '[class*="app-title"]',
    company:     '[class*="company-name"]',
    description: '#content',
  },

  api: {
    // runtime calls this if JSON-LD and DOM both fail
    fetchJob: (companySlug: string, jobId: string) =>
      `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs/${jobId}`,
  },

  navigation: {
    type: "none",    // "none" | "url_param" | "dom_change" | "history_api"
  },
};
```

The shared `portal-runner.ts` reads `capabilities`, `selectors`, `urlPattern`, and `navigation` to drive behavior — no per-portal logic in the runner. Only portals with genuine quirks (Glassdoor title-watch, iCIMS iframe fetch) need imperative escape hatches.

---

### 16.9 Confidence-Based Extraction

**Goal:** Replace binary success/failure extraction with a scored result that enables graceful fallback.

#### Current type:

```typescript
type LinkedInJobData = {
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
};
```

#### Target type:

```typescript
type ExtractedField<T> = {
  value: T;
  confidence: number;   // 0.0–1.0
  source: "json_ld" | "api" | "dom" | "ai" | "title_tag";
};

type NormalizedJobData = {
  title:       ExtractedField<string>;
  company:     ExtractedField<string>;
  description: ExtractedField<string>;
  location:    ExtractedField<string>;
  url:         string;
  fingerprint: JobFingerprint;
};
```

**Confidence thresholds:**

| Source | Default confidence |
|---|---|
| JSON-LD `JobPosting` | 0.95 |
| ATS public API | 0.90 |
| DOM `data-testid` / `data-test` | 0.80 |
| DOM class-name heuristic | 0.60 |
| AI recovery extraction | 0.50 |
| `<title>` tag parse | 0.30 |

**Behavior changes:**
- If `description.confidence < 0.4` → trigger AI recovery extraction (Section 16.10)
- If `title.confidence < 0.6` → show overlay with warning indicator, still show score
- Log all sub-0.7 confidence extractions to telemetry

---

### 16.10 AI Recovery Extraction (Fallback Only)

**Trigger condition:** `description.confidence < 0.4` OR `title.confidence < 0.6` after all non-AI strategies exhausted.

**Cost control:** Never triggered as primary strategy. Only when selectors fail.

**What gets sent to Claude:**

```typescript
// Reduced DOM snapshot — NOT the full page HTML
const snapshot = {
  pageTitle: document.title,
  h1Text: document.querySelector("h1")?.textContent,
  metaDescription: document.querySelector('meta[name="description"]')?.content,
  // First 3000 chars of largest visible text block
  bodyExcerpt: extractLargestTextBlock(document.body, 3000),
};

// Claude prompt:
// "Extract job title, company, location, and whether the apply button is active
//  from this page snapshot. Return JSON only."
```

**Backend endpoint:** `POST /api/v1/ai/extract-job` (new, auth'd)

**Result:** Merged with DOM result using `Math.max(dom.confidence, ai.confidence)` for each field.

---

### 16.11 Telemetry & Observability

**New file:** `src/content/telemetry/tracker.ts`

```typescript
export function track(event: string, props: Record<string, unknown>): void {
  // Fire-and-forget — never block the main flow
  chrome.runtime.sendMessage({
    type: "TELEMETRY",
    payload: {
      event,
      portal: props.portal,
      extensionVersion: chrome.runtime.getManifest().version,
      timestamp: new Date().toISOString(),
      ...props,
    },
  });
}
```

**Background handler** batches events and flushes to `POST /api/v1/telemetry/events` every 30s or on 20-event batch limit.

**Tracked events:**

| Event | Triggered when |
|---|---|
| `job_scrape_success` | extraction completed with confidence ≥ 0.6 |
| `job_scrape_failed` | all extraction strategies exhausted |
| `selector_miss` | a named selector returned null |
| `overlay_injected` | overlay successfully rendered |
| `submission_detected` | submission engine fires |
| `submission_confidence_below_threshold` | detection fired but confidence < 0.85 |
| `spa_navigation` | `watchNavigation` callback fired |
| `extension_context_invalidated` | `isExtensionValid()` returned false |
| `ai_recovery_triggered` | AI fallback extraction used |
| `lifecycle_changed` | job status changed from active |

**Backend storage:** `portal_telemetry_events` table (see Section 16.6). Also expose `GET /api/v1/telemetry/summary` for an internal dashboard showing selector failure rates per portal.

---

### 16.12 Job Observation History

Every time the runtime successfully scrapes a job, it appends a lightweight observation record:

```typescript
// Stored in backend via POST /api/v1/jobs/{applicationId}/observations
type JobObservation = {
  observedAt: string;           // ISO timestamp
  lifecycleStatus: string;      // "active" | "expired" | "closed" | ...
  title: string;                // current title (detect changes)
  company: string;
  pageHash: string;             // SHA-256 of normalized description (detect edits)
  signals: {                    // what was detected
    jsonLdPresent: boolean;
    applyButtonActive: boolean;
    httpStatus: number;
  };
};
```

**Future use cases unlocked:**
- **Repost detection:** same company + title reappears after `removed` lifecycle → `reposted` event
- **Job edit tracking:** `pageHash` changes between observations → content changed (salary added, requirements updated)
- **Salary change tracking:** parse salary range from description on each observation, diff against previous
- **Analytics:** "average time-to-close for Software Engineer roles at FAANG companies"

---

### 16.13 Additional Database Indexes

Beyond the new tables in Section 16.6, add indexes to existing tables:

```sql
-- applications: the two most common extension lookup patterns
CREATE INDEX ix_applications_user_url
  ON applications (user_id, job_url)
  WHERE job_url IS NOT NULL;

CREATE INDEX ix_applications_user_fingerprint
  ON applications (user_id, fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;

CREATE INDEX ix_applications_status
  ON applications (status);

CREATE INDEX ix_applications_lifecycle
  ON applications (lifecycle_status, lifecycle_checked_at)
  WHERE lifecycle_status = 'active';

-- resumes: the autofill "find tailored PDF for this URL" query
CREATE INDEX ix_resumes_application_tailored
  ON resumes (application_id, type)
  WHERE type = 'tailored' AND pdf_bytes IS NOT NULL;
```

---

### 16.14 Sprint Implementation Plan

#### Sprint 1 — Core Reliability

Estimated impact: eliminates premature-scrape and ghost-script crashes.

| Task | Files |
|---|---|
| `waitForStableDOM()` replacing hardcoded 1500ms | `runtime/dom-stability.ts`, `shared/portal-runner.ts` |
| `NavigationManager` centralizing SPA watches | `runtime/navigation-manager.ts`, all adapters |
| `RuntimeManager` state machine + retries | `runtime/runtime-manager.ts` |
| Canonical fingerprinting | `tracking/fingerprint.ts` |
| DB migration: `fingerprint_hash`, `portal`, `canonical_url` on applications | Alembic migration |

---

#### Sprint 2 — Tracking Accuracy

Estimated impact: automatic "Applied" detection, session continuity across redirects.

| Task | Files |
|---|---|
| `SessionManager` (tab-keyed session storage) | `runtime/session-manager.ts` |
| Network submission detector (XHR + fetch intercept) | `submission/network-detector.ts` |
| DOM/redirect success detector | `submission/success-detector.ts` |
| Submission confidence engine + auto-advance | `submission/submission-detector.ts` |
| DB migration: `ats_metadata` JSONB on applications | Alembic migration |

---

#### Sprint 3 — Lifecycle Tracking

Estimated impact: users notified when jobs they applied to are removed or expired.

| Task | Files |
|---|---|
| Closure detection (DOM signals + apply-button watch) | `lifecycle/lifecycle-engine.ts` |
| `job_observations` + `job_lifecycle_events` DB tables | Alembic migration |
| Background revalidation scheduler (backend) | `apps/api/app/tasks/revalidate.py` |
| Lifecycle status field on applications | Alembic migration |
| Notification on lifecycle change | `background/index.ts` (new NOTIFY path) |

---

#### Sprint 4 — Platform Stability

Estimated impact: visibility into selector failures, proactive portal breakage alerts.

| Task | Files |
|---|---|
| `Telemetry.track()` + background batch flush | `telemetry/tracker.ts`, `background/index.ts` |
| `portal_telemetry_events` DB table | Alembic migration |
| Telemetry summary API endpoint | `apps/api/app/api/v1/endpoints/telemetry.py` |
| Confidence-based extraction types (`ExtractedField<T>`) | `shared/types.ts` |
| Declarative adapter config migration (Greenhouse, Lever first) | `adapters/greenhouse.ts`, `adapters/lever.ts` |

---

#### Sprint 5 — Advanced Intelligence

Estimated impact: handles DOM changes without code deployments, unlocks analytics.

| Task | Files |
|---|---|
| AI recovery extraction endpoint | `apps/api/app/api/v1/endpoints/ai.py` |
| AI fallback trigger in runtime-manager | `runtime/runtime-manager.ts` |
| Job observation history storage + API | `apps/api/app/api/v1/endpoints/observations.py` |
| Repost detection logic | `lifecycle/lifecycle-engine.ts` |
| Analytics foundation (observation queries) | `apps/api/app/api/v1/endpoints/analytics.py` |

---

### 16.15 What Does NOT Change

To be explicit about scope — these parts of the current architecture are already correct and are **not replaced** by this roadmap:

| Component | Status |
|---|---|
| Portal adapter interface (`JobPortalAdapter`) | Keep, evolve toward declarative |
| `injectOverlay()` rendering | Keep as-is |
| Autofill engine (`autofill.ts`, `field-detector.ts`) | Keep as-is |
| Background service worker message protocol | Keep, add `TELEMETRY` message type |
| `chrome.storage` schema for session/notifications | Keep, add `af_active_session_{tabId}` |
| `prefill-bridge.ts` → web app bridge | Keep as-is |
| Popup React UI | Keep as-is |
| FastAPI + SQLAlchemy backend structure | Keep, add new endpoints/tables |
| Alembic migration workflow | Keep, add new migrations |
| Vite build system | Keep as-is |

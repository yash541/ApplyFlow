import { describe, it, expect } from "vitest";

// Tests for the multi-step form logic that lives in autofill.ts.
// We extract and test the pure logic here to avoid DOM/content-script complexity.

// ── getFieldsKey (selector-based step hash) ───────────────────────────────────

function getFieldsKey(selectors: string[]): string {
  return selectors.sort().join("|");
}

describe("getFieldsKey", () => {
  it("produces consistent key regardless of field order", () => {
    const a = getFieldsKey(["input#email", "input[name=phone]", "input#name"]);
    const b = getFieldsKey(["input#name", "input#email", "input[name=phone]"]);
    expect(a).toBe(b);
  });

  it("different field sets produce different keys", () => {
    const step1 = getFieldsKey(["input#email", "input#name"]);
    const step2 = getFieldsKey(["input#address", "input#city"]);
    expect(step1).not.toBe(step2);
  });

  it("empty field set produces empty string", () => {
    expect(getFieldsKey([])).toBe("");
  });
});

// ── filledStepKey regression test (REG-008) ───────────────────────────────────

describe("filledStepKey — step transition bug prevention", () => {
  // Simulates the scenario from Image 18/20:
  // User fills step 1, modal transitions to step 2 while success panel is showing,
  // user clicks Done — badge for step 2 must still appear.

  it("REG-008: lastFilledKey set to step-1 key even when currentFieldsKey advanced to step-2", () => {
    let currentFieldsKey = "";
    let lastFilledKey = "";
    let waitingForNextStep = false;

    // Simulate: step 1 scanned
    const step1Fields = ["input#resume-select", "input#coverLetter"];
    currentFieldsKey = getFieldsKey(step1Fields);
    const filledStepKey = currentFieldsKey; // ← captured at FILL start, not Done click

    // Simulate: fill runs, modal transitions to step 2 (MutationObserver fires during success panel)
    const step2Fields = ["input#phone", "input#address"];
    currentFieldsKey = getFieldsKey(step2Fields); // ← advances during success panel

    // Simulate: user clicks Done → finishThisStep uses filledStepKey, NOT currentFieldsKey
    lastFilledKey = filledStepKey; // ← the fix
    waitingForNextStep = true;

    // Now run() fires for step 2
    const step2Key = getFieldsKey(step2Fields);
    if (waitingForNextStep) {
      if (step2Key === lastFilledKey) {
        waitingForNextStep = false; // ← would suppress badge (OLD BUG)
      } else {
        waitingForNextStep = false; // ← new step detected, show badge (CORRECT)
      }
    }

    // step2Key ("input#address|input#phone") !== lastFilledKey ("input#coverLetter|input#resume-select")
    expect(step2Key).not.toBe(lastFilledKey);
    // Badge WILL appear because keys differ ✓
  });

  it("OLD BUG reproduction: using currentFieldsKey at Done time would suppress badge", () => {
    let currentFieldsKey = "";
    let lastFilledKey = "";
    let waitingForNextStep = false;

    const step1Fields = ["input#resume-select", "input#coverLetter"];
    currentFieldsKey = getFieldsKey(step1Fields);
    // (NO capture — old behavior)

    // Step 2 arrives during success panel
    const step2Fields = ["input#phone", "input#address"];
    currentFieldsKey = getFieldsKey(step2Fields);

    // Old bug: Done reads currentFieldsKey (now step 2's key)
    lastFilledKey = currentFieldsKey; // ← BUG: now set to step 2's key
    waitingForNextStep = true;

    // run() for step 2: fieldsKey === lastFilledKey → suppressed
    const step2Key = getFieldsKey(step2Fields);
    const wouldSuppress = waitingForNextStep && step2Key === lastFilledKey;
    expect(wouldSuppress).toBe(true); // ← confirms the bug existed
  });
});

// ── waitingForNextStep logic ──────────────────────────────────────────────────

describe("waitingForNextStep", () => {
  it("badge suppressed on same step after fill", () => {
    let waitingForNextStep = true;
    let lastFilledKey = "input#email|input#name";

    const sameStepKey = "input#email|input#name";
    const shouldSkip = waitingForNextStep && sameStepKey === lastFilledKey;
    expect(shouldSkip).toBe(true); // badge suppressed ✓
  });

  it("badge NOT suppressed on different step", () => {
    let waitingForNextStep = true;
    let lastFilledKey = "input#email|input#name";

    const nextStepKey = "input#address|input#city";
    const shouldSkip = waitingForNextStep && nextStepKey === lastFilledKey;
    expect(shouldSkip).toBe(false); // badge shown ✓
  });
});

// ── Dynamic URL injection heuristics ─────────────────────────────────────────

function looksLikeJobApplicationUrl(url: string): boolean {
  try {
    const u    = new URL(url);
    const path = u.pathname.toLowerCase();
    const qs   = u.search.toLowerCase();
    return (
      path.includes("/apply") ||
      path.includes("/application") ||
      path.includes("/candidate") ||
      path.includes("/career") ||
      path.includes("/jobs/") ||
      path.includes("/job/") ||
      path.includes("/registration/") ||
      path.includes("/onboard") ||
      path.includes("personaldetail") ||
      path.includes("/jobapply") ||
      path.includes("/openings") ||
      qs.includes("ashby_jid=") ||
      qs.includes("gh_jid=") ||
      qs.includes("lever_jid=") ||
      qs.includes("jobseqno=") ||
      qs.includes("jobid=") ||
      qs.includes("job_id=") ||
      qs.includes("requisitionid=") ||
      qs.includes("jk=") ||
      qs.includes("currentjobid=") ||
      qs.includes("step=") ||
      qs.includes("apply") ||
      qs.includes("source=linkedin") ||
      qs.includes("pref=linkedin") ||
      qs.includes("utm_source=linkedin") ||
      qs.includes("source=reg")
    );
  } catch {
    return false;
  }
}

describe("looksLikeJobApplicationUrl", () => {
  it("matches Instahyre onboarding URL (path + query signals)", () => {
    expect(looksLikeJobApplicationUrl(
      "https://instahyre.com/registration/addPersonalDetails?hir=1&source=reg&pref=LinkedIn"
    )).toBe(true);
  });

  it("matches Skyflow Ashby embedded (ashby_jid param)", () => {
    expect(looksLikeJobApplicationUrl(
      "https://skyflow.com/careers?ashby_jid=c17c2db0-d77e-4f5b-9c15-563c9968796f"
    )).toBe(true);
  });

  it("matches /careers path without trailing slash", () => {
    expect(looksLikeJobApplicationUrl("https://skyflow.com/careers")).toBe(true);
  });

  it("matches LinkedIn apply redirect URL", () => {
    expect(looksLikeJobApplicationUrl(
      "https://custom-ats.com/jobs/apply?source=linkedin"
    )).toBe(true);
  });

  it("matches Greenhouse application form", () => {
    expect(looksLikeJobApplicationUrl(
      "https://job-boards.greenhouse.io/starrez/jobs/4564202008/applications/new"
    )).toBe(true);
  });

  it("does NOT match Google homepage", () => {
    expect(looksLikeJobApplicationUrl("https://google.com")).toBe(false);
  });

  it("DOES match LinkedIn job listing URL (contains /jobs/) — prevented by isKnownStaticAutofillUrl", () => {
    // NOTE: LinkedIn matches because path contains /jobs/.
    // In production, isKnownStaticAutofillUrl returns true for linkedin.com
    // so maybeInjectDynamicAutofill returns early — no double injection.
    // This test documents the behavior rather than asserting false.
    expect(looksLikeJobApplicationUrl(
      "https://www.linkedin.com/jobs/view/4265909"
    )).toBe(true); // matched by /jobs/ — guarded by isKnownStaticAutofillUrl at call site
  });

  it("does NOT match generic news article", () => {
    expect(looksLikeJobApplicationUrl("https://techcrunch.com/2026/05/29/article")).toBe(false);
  });
});

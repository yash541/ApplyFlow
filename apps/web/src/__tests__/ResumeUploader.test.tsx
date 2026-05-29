/**
 * Tests for ResumeUploader component.
 *
 * Critical scenarios:
 * - JD missing warning shows when context exists but JD is empty
 * - JD quality tip shows when JD has content
 * - Warning hides once user types in the JD textarea
 * - No warning shown when no extension context (no prefillCompany/Role)
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the store
const mockStore = {
  selectedContent: "",
  selectedFilename: null,
  selectedResumeId: null,
  prefillJd: "",
  prefillCompany: "",
  prefillRole: "",
  setSelectedResume: vi.fn(),
  setTailoredContent: vi.fn(),
  setActiveApplication: vi.fn(),
  setPrefill: vi.fn(),
  clear: vi.fn(),
};

vi.mock("@/store/resumeLab", () => ({
  useResumeLabStore: (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

vi.mock("@/lib/api", () => ({
  api: {
    resumes: {
      upload: vi.fn(),
      getBase: vi.fn(),
    },
  },
  streamTailor: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// Lazy import to pick up mocks
async function renderUploader() {
  const { ResumeUploader } = await import("@/components/resume/ResumeUploader");
  return render(<ResumeUploader />, { wrapper });
}

beforeEach(() => {
  mockStore.selectedContent = "";
  mockStore.selectedFilename = null;
  mockStore.prefillJd = "";
  mockStore.prefillCompany = "";
  mockStore.prefillRole = "";
  vi.clearAllMocks();
});

// ── No extension context ──────────────────────────────────────────────────────

describe("No extension context (direct navigation)", () => {
  it("does not show the JD missing warning", async () => {
    await renderUploader();
    expect(screen.queryByText(/job description missing/i)).not.toBeInTheDocument();
  });

  it("does not show the JD quality tip", async () => {
    await renderUploader();
    expect(screen.queryByText(/for best tailoring results/i)).not.toBeInTheDocument();
  });

  it("shows the Job Description label", async () => {
    await renderUploader();
    expect(screen.getByText("Job Description")).toBeInTheDocument();
  });
});

// ── Extension context — JD missing ───────────────────────────────────────────

describe("Extension context: came from job page, JD missing", () => {
  beforeEach(() => {
    mockStore.prefillCompany = "Acme Corp";
    mockStore.prefillRole = "Software Engineer";
    mockStore.prefillJd = "";
  });

  it("shows the amber JD missing warning", async () => {
    await renderUploader();
    expect(screen.getByText(/job description missing/i)).toBeInTheDocument();
  });

  it("shows helpful copy in the warning", async () => {
    await renderUploader();
    expect(
      screen.getByText(/paste the job description below/i)
    ).toBeInTheDocument();
  });

  it("shows the linked job context", async () => {
    await renderUploader();
    expect(screen.getByText(/tailoring for/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it("warning disappears once user types JD", async () => {
    const user = userEvent.setup();
    await renderUploader();

    // Warning initially visible
    expect(screen.getByText(/job description missing/i)).toBeInTheDocument();

    // User types in the textarea
    const textarea = screen.getByPlaceholderText(/paste job description here/i);
    await user.type(textarea, "We are looking for a software engineer...");

    // Warning should be gone
    await waitFor(() => {
      expect(screen.queryByText(/job description missing/i)).not.toBeInTheDocument();
    });
  });

  it("textarea gets amber border when JD missing", async () => {
    await renderUploader();
    const textarea = screen.getByPlaceholderText(/paste job description here/i);
    expect(textarea.className).toContain("amber");
  });
});

// ── Extension context — JD present ───────────────────────────────────────────

describe("Extension context: JD pre-filled from job page", () => {
  beforeEach(() => {
    mockStore.prefillCompany = "BayOne Solutions";
    mockStore.prefillRole = "Software Development Engineer II";
    mockStore.prefillJd = "We are hiring a senior full-stack engineer...";
  });

  it("does NOT show the JD missing warning", async () => {
    await renderUploader();
    expect(screen.queryByText(/job description missing/i)).not.toBeInTheDocument();
  });

  it("shows the quality tip when JD has content", async () => {
    await renderUploader();
    // The tip appears when the textarea has content
    const textarea = screen.getByPlaceholderText(/paste job description here/i);
    // Trigger the value population by simulating prefillJd effect
    fireEvent.change(textarea, {
      target: { value: "We are hiring a senior full-stack engineer..." },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/for best tailoring results/i)
      ).toBeInTheDocument();
    });
  });
});

// ── Tailor button state ───────────────────────────────────────────────────────

describe("Tailor button state", () => {
  it("is disabled when no resume selected", async () => {
    await renderUploader();
    const btn = screen.getByRole("button", { name: /select a resume first/i });
    expect(btn).toBeDisabled();
  });

  it("shows 'AI Tailor Resume' when resume is selected", async () => {
    mockStore.selectedContent = "Experienced engineer with 5 years...";
    await renderUploader();
    const btn = screen.getByRole("button", { name: /ai tailor resume/i });
    expect(btn).toBeInTheDocument();
  });

  it("button is disabled when resume selected but no JD", async () => {
    mockStore.selectedContent = "Resume content here...";
    await renderUploader();
    const btn = screen.getByRole("button", { name: /ai tailor resume/i });
    expect(btn).toBeDisabled();
  });
});

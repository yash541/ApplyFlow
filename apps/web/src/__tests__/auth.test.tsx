/**
 * Tests for LoginForm and SignupForm components.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/login",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockSetAuth = vi.fn();
vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: (s: { setAuth: typeof mockSetAuth }) => unknown) =>
    selector({ setAuth: mockSetAuth }),
}));

const mockApiLogin = vi.fn();
const mockApiRegister = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      login: mockApiLogin,
      register: mockApiRegister,
    },
  },
}));

// ── LoginForm ─────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function renderLogin() {
    const { LoginForm } = await import("@/components/auth/LoginForm");
    return render(<LoginForm />);
  }

  it("renders email and password inputs", async () => {
    await renderLogin();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    mockApiLogin.mockRejectedValueOnce(new Error("Invalid email or password"));
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "wrong@test.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "badpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls setAuth and redirects to /dashboard on success", async () => {
    const fakeUser = { id: "u1", name: "Test", email: "t@t.com", plan: "free", createdAt: "" };
    mockApiLogin.mockResolvedValueOnce({ access_token: "tok-123", user: fakeUser });
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "t@t.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "pass123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(fakeUser, "tok-123");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows Signing in… while request in flight", async () => {
    let resolve!: (v: unknown) => void;
    mockApiLogin.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "t@t.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "pass");
    const clickP = user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });

    resolve({ access_token: "t", user: { id: "u", name: "N", email: "e", plan: "free", createdAt: "" } });
    await clickP;
  });
});

// ── SignupForm ────────────────────────────────────────────────────────────────

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function renderSignup() {
    const { SignupForm } = await import("@/components/auth/SignupForm");
    return render(<SignupForm />);
  }

  it("renders name, email, password fields", async () => {
    await renderSignup();
    // Find all input placeholders
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows error on failed registration", async () => {
    mockApiRegister.mockRejectedValueOnce(new Error("Email already registered"));
    const user = userEvent.setup();
    const { container } = await renderSignup();

    const inputs = container.querySelectorAll("input");
    await user.type(inputs[0], "Test User");   // name
    await user.type(inputs[1], "taken@e.com"); // email
    await user.type(inputs[2], "pass123");     // password
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });

  it("redirects to /dashboard on successful registration", async () => {
    const fakeUser = { id: "u2", name: "New", email: "new@e.com", plan: "free", createdAt: "" };
    mockApiRegister.mockResolvedValueOnce({ access_token: "new-tok", user: fakeUser });
    const user = userEvent.setup();
    const { container } = await renderSignup();

    const inputs = container.querySelectorAll("input");
    await user.type(inputs[0], "New User");
    await user.type(inputs[1], "new@e.com");
    await user.type(inputs[2], "pass123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(fakeUser, "new-tok");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});

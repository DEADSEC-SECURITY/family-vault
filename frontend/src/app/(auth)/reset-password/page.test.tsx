import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      validateReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
}));

import ResetPasswordPage from "./page";
import { api } from "@/lib/api";
const mockValidateReset = vi.mocked(api.auth.validateReset);
const mockResetPassword = vi.mocked(api.auth.resetPassword);

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((key: string) =>
      key === "token" ? "valid-reset-token" : null
    );
  });

  it("shows invalid link when token validation fails", async () => {
    mockValidateReset.mockResolvedValue({ valid: false });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Link")).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
  });

  it("shows password form when token is valid", async () => {
    mockValidateReset.mockResolvedValue({ valid: true });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Set New Password")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows error for short password", async () => {
    mockValidateReset.mockResolvedValue({ valid: true });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    mockValidateReset.mockResolvedValue({ valid: true });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "different123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows success message after successful reset", async () => {
    mockValidateReset.mockResolvedValue({ valid: true });
    mockResetPassword.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "newpass12345");
    await user.type(screen.getByLabelText("Confirm Password"), "newpass12345");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => {
      expect(screen.getByText("Password Reset")).toBeInTheDocument();
      expect(screen.getByText(/reset successfully/)).toBeInTheDocument();
    });
    expect(mockResetPassword).toHaveBeenCalledWith({
      token: "valid-reset-token",
      password: "newpass12345",
    });
  });

  it("shows invalid link when no token in URL", async () => {
    mockGet.mockReturnValue(null);
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Link")).toBeInTheDocument();
    });
    expect(mockValidateReset).not.toHaveBeenCalled();
  });

  it("has a back to login link in the form", async () => {
    mockValidateReset.mockResolvedValue({ valid: true });
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText("Back to login")).toBeInTheDocument();
    });
    expect(screen.getByText("Back to login").closest("a")).toHaveAttribute("href", "/login");
  });
});

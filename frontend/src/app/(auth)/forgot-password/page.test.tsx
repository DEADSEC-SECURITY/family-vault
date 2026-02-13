import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "./page";

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      forgotPassword: vi.fn(),
    },
  },
}));

import { api } from "@/lib/api";
const mockForgotPassword = vi.mocked(api.auth.forgotPassword);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email form initially", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText("Reset Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
  });

  it("shows success message after submission", async () => {
    mockForgotPassword.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
      expect(screen.getByText(/password reset link has been sent/)).toBeInTheDocument();
    });
    expect(mockForgotPassword).toHaveBeenCalledWith("test@example.com");
  });

  it("shows error on API failure", async () => {
    mockForgotPassword.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("has a link back to login", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText("Back to login");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });
});

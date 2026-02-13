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
      validateInvite: vi.fn(),
      acceptInvite: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  setToken: vi.fn(),
  setStoredUser: vi.fn(),
  setActiveOrgId: vi.fn(),
}));

import AcceptInvitePage from "./page";
import { api } from "@/lib/api";
const mockValidateInvite = vi.mocked(api.auth.validateInvite);
const mockAcceptInvite = vi.mocked(api.auth.acceptInvite);

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((key: string) =>
      key === "token" ? "valid-token" : null
    );
  });

  it("shows invalid invitation when token validation fails", async () => {
    mockValidateInvite.mockResolvedValue({
      valid: false,
      email: null,
      full_name: null,
      org_name: null,
    });

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument();
    });
  });

  it("shows invitation form when token is valid", async () => {
    mockValidateInvite.mockResolvedValue({
      valid: true,
      email: "jane@example.com",
      full_name: "Jane Doe",
      org_name: "Doe Family",
    });

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Doe Family/)).toBeInTheDocument();
    expect(screen.getByLabelText("Create Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows error for short password", async () => {
    mockValidateInvite.mockResolvedValue({
      valid: true,
      email: "jane@example.com",
      full_name: "Jane Doe",
      org_name: "Doe Family",
    });

    const user = userEvent.setup();
    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: "Accept Invitation" }));

    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    mockValidateInvite.mockResolvedValue({
      valid: true,
      email: "jane@example.com",
      full_name: "Jane Doe",
      org_name: "Doe Family",
    });

    const user = userEvent.setup();
    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "different123");
    await user.click(screen.getByRole("button", { name: "Accept Invitation" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("redirects to dashboard on successful accept", async () => {
    mockValidateInvite.mockResolvedValue({
      valid: true,
      email: "jane@example.com",
      full_name: "Jane Doe",
      org_name: "Doe Family",
    });
    mockAcceptInvite.mockResolvedValue({
      token: "new-session-token",
      user: {
        id: "user-1",
        email: "jane@example.com",
        full_name: "Jane Doe",
        active_org_id: "org-1",
      },
    });

    const user = userEvent.setup();
    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Accept Invitation" }));

    await waitFor(() => {
      expect(mockAcceptInvite).toHaveBeenCalledWith({
        token: "valid-token",
        password: "password123",
      });
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows invalid invitation when no token in URL", async () => {
    mockGet.mockReturnValue(null);
    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument();
    });
    expect(mockValidateInvite).not.toHaveBeenCalled();
  });
});

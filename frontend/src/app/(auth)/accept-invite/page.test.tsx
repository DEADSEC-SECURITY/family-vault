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

// Mock crypto functions — use inline objects since vi.mock is hoisted
vi.mock("@/lib/crypto", () => ({
  deriveMasterKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  deriveSymmetricKey: vi.fn().mockResolvedValue({} as CryptoKey),
  hashMasterPassword: vi.fn().mockResolvedValue("hashed-password"),
  generateKeyPair: vi.fn().mockResolvedValue({ publicKey: {} as CryptoKey, privateKey: {} as CryptoKey }),
  exportPublicKey: vi.fn().mockResolvedValue("public-key-b64"),
  encryptPrivateKey: vi.fn().mockResolvedValue("encrypted-private-key-b64"),
  importPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
  exportRecoveryKey: vi.fn().mockReturnValue("recovery-key-b64"),
  encryptPrivateKeyForRecovery: vi.fn().mockResolvedValue("recovery-encrypted-pk"),
}));

vi.mock("@/lib/key-store", () => ({
  keyStore: {
    setMasterKey: vi.fn(),
    setSymmetricKey: vi.fn(),
    setPrivateKey: vi.fn(),
    setPublicKey: vi.fn(),
  },
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
    expect(screen.getByLabelText("Create Master Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Master Password")).toBeInTheDocument();
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
      expect(screen.getByLabelText("Create Master Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Master Password"), "short");
    await user.type(screen.getByLabelText("Confirm Master Password"), "short");
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
      expect(screen.getByLabelText("Create Master Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Master Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Master Password"), "different123");
    await user.click(screen.getByRole("button", { name: "Accept Invitation" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows recovery key on successful accept, then redirects on confirmation", async () => {
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
        created_at: "2024-01-01T00:00:00Z",
      },
    });

    const user = userEvent.setup();
    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create Master Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Create Master Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Master Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Accept Invitation" }));

    // Should show recovery key screen
    await waitFor(() => {
      expect(screen.getByText("Save Your Recovery Key")).toBeInTheDocument();
    });
    expect(screen.getByText("recovery-key-b64")).toBeInTheDocument();

    // API should have been called with ZK fields
    expect(mockAcceptInvite).toHaveBeenCalledWith({
      token: "valid-token",
      password: "zero-knowledge",
      master_password_hash: "hashed-password",
      encrypted_private_key: "encrypted-private-key-b64",
      public_key: "public-key-b64",
      recovery_encrypted_private_key: "recovery-encrypted-pk",
      kdf_iterations: 600000,
    });

    // Click to proceed to dashboard
    await user.click(screen.getByRole("button", { name: /saved my recovery key/i }));
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

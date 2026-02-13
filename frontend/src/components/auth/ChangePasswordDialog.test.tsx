import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      changePassword: vi.fn(),
    },
  },
}));

import { api } from "@/lib/api";
const mockChangePassword = vi.mocked(api.auth.changePassword);

describe("ChangePasswordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog fields when open", () => {
    render(<ChangePasswordDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("shows error for short new password", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordDialog open={true} onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "short");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByText("New password must be at least 8 characters")).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordDialog open={true} onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpassword1");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpassword2");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByText("New passwords do not match")).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("calls API and shows success message on valid submission", async () => {
    mockChangePassword.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ChangePasswordDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass12345");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass12345");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() => {
      expect(screen.getByText("Password changed successfully!")).toBeInTheDocument();
    });
    expect(mockChangePassword).toHaveBeenCalledWith({
      current_password: "oldpass123",
      new_password: "newpass12345",
    });
  });

  it("shows API error message on failure", async () => {
    mockChangePassword.mockRejectedValue(new Error("Current password is incorrect"));
    const user = userEvent.setup();
    render(<ChangePasswordDialog open={true} onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Current Password"), "wrongpass");
    await user.type(screen.getByLabelText("New Password"), "newpass12345");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass12345");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() => {
      expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
    });
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ChangePasswordDialog open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

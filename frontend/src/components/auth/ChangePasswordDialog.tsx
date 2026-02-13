"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import {
  deriveMasterKey,
  deriveSymmetricKey,
  hashMasterPassword,
  encryptPrivateKey,
  exportRecoveryKey,
  encryptPrivateKeyForRecovery,
} from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
    setRecoveryKey(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (keyStore.isInitialized) {
        // ZK mode: re-derive keys and re-encrypt private key
        const user = getStoredUser();
        if (!user) throw new Error("User data not available");

        const oldMasterKey = keyStore.getMasterKey();
        const currentHash = await hashMasterPassword(oldMasterKey, currentPassword);

        // Derive new keys
        const newMasterKey = await deriveMasterKey(newPassword, user.email);
        const newSymmetricKey = await deriveSymmetricKey(newMasterKey);
        const newHash = await hashMasterPassword(newMasterKey, newPassword);

        // Re-encrypt private key with new symmetric key
        const privateKey = keyStore.getPrivateKey();
        const newEncryptedPK = await encryptPrivateKey(privateKey, newSymmetricKey);

        // Generate new recovery key
        const newRecoveryKey = await exportRecoveryKey(newMasterKey);
        const newRecoveryEncPK = await encryptPrivateKeyForRecovery(
          privateKey,
          newRecoveryKey,
        );

        await api.auth.changePassword({
          current_password: "zero-knowledge",
          new_password: "zero-knowledge",
          current_master_password_hash: currentHash,
          new_master_password_hash: newHash,
          new_encrypted_private_key: newEncryptedPK,
          new_recovery_encrypted_private_key: newRecoveryEncPK,
        });

        // Update keyStore with new keys
        keyStore.setMasterKey(newMasterKey);
        keyStore.setSymmetricKey(newSymmetricKey);

        // Show new recovery key
        setRecoveryKey(newRecoveryKey);
      } else {
        // Legacy mode
        await api.auth.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 1500);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Master Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        {recoveryKey ? (
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Password changed successfully!
            </div>
            <p className="text-sm text-gray-700 font-medium">
              Save your new recovery key:
            </p>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
              <p className="font-mono text-sm break-all select-all text-center">
                {recoveryKey}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Your old recovery key no longer works. Save this new key in a safe place.
            </p>
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                I&apos;ve Saved My Recovery Key
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  Password changed successfully!
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={success}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={success}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={success}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || success}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

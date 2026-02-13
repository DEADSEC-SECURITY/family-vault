"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  deriveMasterKey,
  deriveSymmetricKey,
  hashMasterPassword,
  encryptPrivateKey,
  decryptPrivateKeyWithRecovery,
  exportRecoveryKey,
  encryptPrivateKeyForRecovery,
} from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

interface ResetInfo {
  valid: boolean;
  email: string | null;
  recovery_encrypted_private_key: string | null;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [resetInfo, setResetInfo] = useState<ResetInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);

  const isZkUser = !!resetInfo?.recovery_encrypted_private_key;

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    api.auth
      .validateReset(token)
      .then((data) => setResetInfo(data as ResetInfo))
      .catch(() => setResetInfo({ valid: false, email: null, recovery_encrypted_private_key: null }))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (isZkUser && resetInfo?.email) {
        // ZK mode: recovery key required
        if (!recoveryKeyInput.trim()) {
          setError("Recovery key is required for zero-knowledge accounts");
          setLoading(false);
          return;
        }

        // Decrypt private key with recovery key
        const privateKey = await decryptPrivateKeyWithRecovery(
          resetInfo.recovery_encrypted_private_key!,
          recoveryKeyInput.trim(),
        );

        // Derive new keys
        const newMasterKey = await deriveMasterKey(password, resetInfo.email);
        const newSymmetricKey = await deriveSymmetricKey(newMasterKey);
        const newHash = await hashMasterPassword(newMasterKey, password);

        // Re-encrypt private key
        const newEncryptedPK = await encryptPrivateKey(privateKey, newSymmetricKey);

        // New recovery key
        const newRecoveryKeyB64 = await exportRecoveryKey(newMasterKey);
        const newRecoveryEncPK = await encryptPrivateKeyForRecovery(
          privateKey,
          newRecoveryKeyB64,
        );

        await api.auth.resetPassword({
          token,
          password: "zero-knowledge",
          master_password_hash: newHash,
          encrypted_private_key: newEncryptedPK,
          recovery_encrypted_private_key: newRecoveryEncPK,
          kdf_iterations: 600000,
        });

        setNewRecoveryKey(newRecoveryKeyB64);
      } else {
        // Legacy mode
        await api.auth.resetPassword({ token, password });
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!token || !resetInfo?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Invalid Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push("/forgot-password")}>
              Request New Link
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show new recovery key after ZK reset
  if (newRecoveryKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
            <CardDescription>
              Your password has been reset. Save your new recovery key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Password reset successfully!
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
              <p className="font-mono text-sm break-all select-all text-center">
                {newRecoveryKey}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Your old recovery key no longer works. Save this new key in a safe place.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
            <CardDescription>
              Your password has been reset successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              You can now sign in with your new password.
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {isZkUser && (
              <div className="space-y-2">
                <Label htmlFor="recoveryKey">Recovery Key</Label>
                <Input
                  id="recoveryKey"
                  type="text"
                  placeholder="Paste your recovery key"
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Your recovery key was shown when you first created your account.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline">
                Back to login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

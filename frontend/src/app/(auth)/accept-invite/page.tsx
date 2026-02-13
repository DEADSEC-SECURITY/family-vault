"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { InviteValidation } from "@/lib/api";
import { setToken, setStoredUser, setActiveOrgId } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import {
  deriveMasterKey,
  deriveSymmetricKey,
  hashMasterPassword,
  generateKeyPair,
  exportPublicKey,
  encryptPrivateKey,
  importPublicKey,
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
import RecoveryCodesCard from "@/components/auth/RecoveryCodesCard";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [invite, setInvite] = useState<InviteValidation | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    api.auth
      .validateInvite(token)
      .then((data) => setInvite(data))
      .catch(() => setInvite({ valid: false, email: null, full_name: null, org_name: null }))
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
      const email = invite!.email!;

      // Derive master key
      const masterKey = await deriveMasterKey(password, email);

      // Derive symmetric key and master password hash
      const symmetricKey = await deriveSymmetricKey(masterKey);
      const masterPasswordHash = await hashMasterPassword(masterKey, password);

      // Generate RSA keypair
      const keyPair = await generateKeyPair();
      const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
      const encryptedPrivateKeyB64 = await encryptPrivateKey(keyPair.privateKey, symmetricKey);

      // Generate recovery key and encrypt private key for recovery
      const recoveryKeyB64 = await exportRecoveryKey(masterKey);
      const recoveryEncryptedPrivateKey = await encryptPrivateKeyForRecovery(
        keyPair.privateKey,
        recoveryKeyB64,
      );

      // Accept invitation with ZK data
      const res = await api.auth.acceptInvite({
        token,
        password: "zero-knowledge",
        master_password_hash: masterPasswordHash,
        encrypted_private_key: encryptedPrivateKeyB64,
        public_key: publicKeyB64,
        recovery_encrypted_private_key: recoveryEncryptedPrivateKey,
        kdf_iterations: 600000,
      });

      // Store session
      setToken(res.token);
      setStoredUser(res.user);
      if (res.user.active_org_id) {
        setActiveOrgId(res.user.active_org_id);
      }

      // Initialize keyStore
      const publicKey = await importPublicKey(publicKeyB64);
      keyStore.setMasterKey(masterKey);
      keyStore.setSymmetricKey(symmetricKey);
      keyStore.setPrivateKey(keyPair.privateKey);
      keyStore.setPublicKey(publicKey);

      // Note: no org key yet — existing member must perform key ceremony

      // Show recovery key
      setRecoveryKey(recoveryKeyB64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
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

  if (!token || !invite?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please ask the vault owner to resend the invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show recovery key after successful acceptance
  if (recoveryKey) {
    return <RecoveryCodesCard recoveryKey={recoveryKey} message={"A vault admin still needs to grant you access to the encrypted data. You&apos;ll be notified when access is ready."} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">FamilyVault</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join{" "}
            <strong>{invite.org_name}</strong>
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="rounded-md bg-violet-50 p-3 text-sm text-violet-700">
              <p>
                <strong>{invite.full_name}</strong>
              </p>
              <p className="text-violet-600">{invite.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Create Master Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Master Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-gray-500">
              Your master password encrypts your vault. It cannot be recovered if forgotten.
            </p>
          </CardContent>
          <CardFooter className="pt-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up encryption..." : "Accept Invitation"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { createContext, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setToken, setStoredUser, setActiveOrgId } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import {
  deriveMasterKey,
  deriveSymmetricKey,
  hashMasterPassword,
  generateKeyPair,
  exportPublicKey,
  encryptPrivateKey,
  generateOrgKey,
  wrapOrgKey,
  exportRecoveryKey,
  encryptPrivateKeyForRecovery,
  CRYPTO_CONSTANTS,
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
import { Copy, Check, ShieldCheck } from "lucide-react";
import RecoveryCodesCard from "./RecoveryCodesCard";

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Recovery key step
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  // Hold registration data for after recovery confirmation
  const [pendingRegData, setPendingRegData] = useState<{
    token: string;
    user: {
      id: string;
      email: string;
      full_name: string;
      active_org_id: string | null;
    };
    orgKey: Uint8Array;
    orgId: string | null;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      // 1. Derive master key from password + email
      const masterKey = await deriveMasterKey(
        password,
        email,
        CRYPTO_CONSTANTS.KDF_ITERATIONS,
      );

      // 2. Derive symmetric key from master key
      const symmetricKey = await deriveSymmetricKey(masterKey);

      // 3. Compute master password hash (this is what server stores)
      const masterPasswordHash = await hashMasterPassword(masterKey, password);

      // 4. Generate RSA keypair
      const keyPair = await generateKeyPair();

      // 5. Export public key
      const publicKeyB64 = await exportPublicKey(keyPair.publicKey);

      // 6. Encrypt private key with symmetric key
      const encryptedPrivateKey = await encryptPrivateKey(
        keyPair.privateKey,
        symmetricKey,
      );

      // 7. Generate org key and wrap it with the user's public key
      const orgKey = generateOrgKey();
      const encryptedOrgKey = await wrapOrgKey(orgKey, keyPair.publicKey);

      // 8. Generate recovery key and encrypt private key for recovery
      const recoveryKeyB64 = await exportRecoveryKey(masterKey);
      const recoveryEncryptedPrivateKey = await encryptPrivateKeyForRecovery(
        keyPair.privateKey,
        recoveryKeyB64,
      );

      // 9. Register with the server (server never sees password or master key)
      const res = await api.auth.register({
        email,
        password: "zero-knowledge", // placeholder — server uses master_password_hash
        full_name: fullName,
        master_password_hash: masterPasswordHash,
        encrypted_private_key: encryptedPrivateKey,
        public_key: publicKeyB64,
        encrypted_org_key: encryptedOrgKey,
        recovery_encrypted_private_key: recoveryEncryptedPrivateKey,
        kdf_iterations: CRYPTO_CONSTANTS.KDF_ITERATIONS,
      });

      // 10. Store keys in memory
      keyStore.setMasterKey(masterKey);
      keyStore.setSymmetricKey(symmetricKey);
      keyStore.setPrivateKey(keyPair.privateKey);
      keyStore.setPublicKey(keyPair.publicKey);
      if (res.user.active_org_id) {
        keyStore.setOrgKey(res.user.active_org_id, orgKey);
      }

      // 11. Show recovery key before completing registration
      setRecoveryKey(recoveryKeyB64);
      setPendingRegData({
        token: res.token,
        user: res.user,
        orgKey,
        orgId: res.user.active_org_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmRecovery() {
    if (!pendingRegData) return;

    setToken(pendingRegData.token);
    setStoredUser(pendingRegData.user);
    if (pendingRegData.orgId) {
      setActiveOrgId(pendingRegData.orgId);
    }
    router.push("/dashboard");
  }

  // Recovery key confirmation screen
  if (recoveryKey) {
    return (
      <RecoveryCodesCard
        recoveryKey={recoveryKey}
        confirmRecovery={handleConfirmRecovery}
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">FamilyVault</CardTitle>
        <CardDescription>Create your zero-knowledge vault</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Master Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500">
              Your master password is used to encrypt your vault. It is never
              sent to the server.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Master Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Generating keys..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setToken, setStoredUser, setActiveOrgId } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import {
  deriveMasterKey,
  deriveSymmetricKey,
  hashMasterPassword,
  decryptPrivateKey,
  unwrapOrgKey,
  importPublicKey,
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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Pre-login: get KDF iterations and ZK status for this email
      const prelogin = await api.auth.prelogin(email);

      let res;
      if (prelogin.is_zero_knowledge) {
        // ZK mode: derive master key and send hash
        const masterKey = await deriveMasterKey(
          password,
          email,
          prelogin.kdf_iterations,
        );
        const masterPasswordHash = await hashMasterPassword(masterKey, password);

        res = await api.auth.login({
          email,
          password: "zero-knowledge",
          master_password_hash: masterPasswordHash,
        });

        // Store session
        setToken(res.token);
        setStoredUser(res.user);
        if (res.user.active_org_id) {
          setActiveOrgId(res.user.active_org_id);
        }

        // Decrypt keys if present
        if (res.encrypted_private_key && res.public_key) {
          const symmetricKey = await deriveSymmetricKey(masterKey);
          const privateKey = await decryptPrivateKey(
            res.encrypted_private_key,
            symmetricKey,
          );
          const publicKey = await importPublicKey(res.public_key);

          keyStore.setMasterKey(masterKey);
          keyStore.setSymmetricKey(symmetricKey);
          keyStore.setPrivateKey(privateKey);
          keyStore.setPublicKey(publicKey);

          if (res.encrypted_org_key && res.user.active_org_id) {
            const orgKey = await unwrapOrgKey(res.encrypted_org_key, privateKey);
            keyStore.setOrgKey(res.user.active_org_id, orgKey);
          }
        }
      } else {
        // Legacy mode: send raw password
        res = await api.auth.login({ email, password });

        setToken(res.token);
        setStoredUser(res.user);
        if (res.user.active_org_id) {
          setActiveOrgId(res.user.active_org_id);
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">FamilyVault</CardTitle>
        <CardDescription>Sign in to your vault</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Master Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Decrypting vault..." : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, X } from "lucide-react";
import { api } from "@/lib/api";
import type { PendingKeyMember } from "@/lib/api";
import { getActiveOrgId } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import { importPublicKey, wrapOrgKey } from "@/lib/crypto";
import { Button } from "@/components/ui/button";

/**
 * Banner shown to users who have the org key, indicating that
 * new members need the key ceremony to gain vault access.
 */
export function KeyCeremonyBanner() {
  const [pending, setPending] = useState<PendingKeyMember[]>([]);
  const [granting, setGranting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  const checkPending = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId || !keyStore.isInitialized || !keyStore.hasOrgKey(orgId)) return;

    try {
      const members = await api.auth.getPendingKeys(orgId);
      setPending(members);
    } catch {
      // Silently fail — user may not have permission or network issue
    }
  }, []);

  useEffect(() => {
    checkPending();
  }, [checkPending]);

  async function handleGrantAccess() {
    const orgId = getActiveOrgId();
    if (!orgId) return;

    setGranting(true);
    setError("");

    try {
      const orgKey = keyStore.getOrgKey(orgId);

      for (const member of pending) {
        const publicKey = await importPublicKey(member.public_key);
        const wrappedKey = await wrapOrgKey(orgKey, publicKey);
        await api.auth.storeOrgKey(orgId, member.user_id, wrappedKey);
      }

      setPending([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setGranting(false);
    }
  }

  if (pending.length === 0 || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-800">
              {pending.length} member{pending.length > 1 ? "s" : ""} waiting for vault access
            </span>
            <span className="text-amber-700 ml-1">
              ({pending.map((m) => m.full_name).join(", ")})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={handleGrantAccess}
            disabled={granting}
          >
            {granting ? "Granting..." : "Grant Access"}
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner shown to users who don't have an org key yet
 * (accepted invitation but waiting for key ceremony).
 */
export function WaitingForAccessBanner() {
  const orgId = getActiveOrgId();

  // Only show if user has ZK keys but no org key
  if (!keyStore.isInitialized) return null;
  if (!orgId) return null;
  if (keyStore.hasOrgKey(orgId)) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <Shield className="h-5 w-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800">
          Your account is set up, but a vault admin needs to grant you access to the encrypted data.
          Please ask the vault owner to log in and approve your access.
        </p>
      </div>
    </div>
  );
}

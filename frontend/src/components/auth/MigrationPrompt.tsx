"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { api } from "@/lib/api";
import { keyStore } from "@/lib/key-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "migration_prompt_dismissed";

export function MigrationPrompt() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v1Items, setV1Items] = useState(0);
  const [v1Files, setV1Files] = useState(0);

  useEffect(() => {
    // Only check for ZK users who have keys loaded
    if (!keyStore.isInitialized) return;

    // Don't show again if dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    api.migration
      .status()
      .then((s) => {
        if (s.items_v1 > 0 || s.files_v1 > 0) {
          setV1Items(s.items_v1);
          setV1Files(s.files_v1);
          setOpen(true);
        }
      })
      .catch(() => {
        // Silently ignore — don't block the app
      });
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  }

  function handleMigrate() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
    router.push("/settings/encryption");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 p-3 bg-amber-100 rounded-full w-fit">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">
            Encryption Upgrade Available
          </DialogTitle>
          <DialogDescription className="text-center">
            Your vault has{" "}
            <strong>
              {v1Items} item{v1Items !== 1 ? "s" : ""}
              {v1Files > 0 && (
                <>
                  {" "}and {v1Files} file{v1Files !== 1 ? "s" : ""}
                </>
              )}
            </strong>{" "}
            still using server-side encryption. We recommend migrating to
            zero-knowledge encryption so only you can access your data.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={handleMigrate}>
            Migrate Now
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleDismiss}
          >
            Remind Me Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

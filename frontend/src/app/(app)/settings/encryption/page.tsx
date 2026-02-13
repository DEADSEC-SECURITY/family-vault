"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { MigrationStatus } from "@/lib/api";
import { updateStoredUser } from "@/lib/auth";

export default function EncryptionMigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migratingItems, setMigratingItems] = useState(false);
  const [migratingFiles, setMigratingFiles] = useState(false);
  const [itemProgress, setItemProgress] = useState({ done: 0, total: 0 });
  const [fileProgress, setFileProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.migration.pending();
      setStatus(s);
      if (s.items_v1 === 0 && s.files_v1 === 0) {
        updateStoredUser({ migration_items_v1: 0, migration_files_v1: 0 });
      }
    } catch {
      setError("Failed to fetch migration status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleMigrateItems = async () => {
    setMigratingItems(true);
    setError(null);
    try {
      const count = await api.migration.migrateItems((done, total) => {
        setItemProgress({ done, total });
      });
      await fetchStatus();
      setItemProgress({ done: count, total: count });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Item migration failed");
    } finally {
      setMigratingItems(false);
    }
  };

  const handleMigrateFiles = async () => {
    setMigratingFiles(true);
    setError(null);
    try {
      const count = await api.migration.migrateFiles((done, total) => {
        setFileProgress({ done, total });
      });
      await fetchStatus();
      setFileProgress({ done: count, total: count });
    } catch (e) {
      setError(e instanceof Error ? e.message : "File migration failed");
    } finally {
      setMigratingFiles(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allMigrated = status && status.items_v1 === 0 && status.files_v1 === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Encryption Migration</h1>
        <p className="text-muted-foreground mt-1">
          Upgrade your data from server-side encryption (v1) to zero-knowledge
          client-side encryption (v2).
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {allMigrated && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          All data is using client-side encryption. No migration needed.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server-side (v1)</span>
                <span className="font-medium">{status?.items_v1 ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client-side (v2)</span>
                <span className="font-medium">{status?.items_v2 ?? "—"}</span>
              </div>
            </div>
            {status && status.items_v1 > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={handleMigrateItems}
                disabled={migratingItems}
              >
                {migratingItems ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Migrating {itemProgress.done}/{itemProgress.total}...
                  </>
                ) : (
                  `Migrate ${status.items_v1} items`
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server-side (v1)</span>
                <span className="font-medium">{status?.files_v1 ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client-side (v2)</span>
                <span className="font-medium">{status?.files_v2 ?? "—"}</span>
              </div>
            </div>
            {status && status.files_v1 > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={handleMigrateFiles}
                disabled={migratingFiles || migratingItems}
              >
                {migratingFiles ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Migrating {fileProgress.done}/{fileProgress.total}...
                  </>
                ) : (
                  `Migrate ${status.files_v1} files`
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Items also migrate automatically when you open them. This page lets you
        migrate everything at once. Files require re-downloading and re-uploading
        through your browser, so file migration may take longer for large files.
      </p>
    </div>
  );
}

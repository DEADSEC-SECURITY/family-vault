"use client";

import { useState } from "react";
import { Download, File, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { FileAttachmentType } from "@/lib/api";

interface FileListProps {
  files: FileAttachmentType[];
  onDeleted: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({ files, onDeleted }: FileListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(fileId: string) {
    setDeleting(fileId);
    try {
      await api.files.delete(fileId);
      onDeleted();
    } catch (err) {
      console.error("Failed to delete file:", err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleDownload(fileId: string, fileName: string, encryptionVersion?: number) {
    try {
      const blobUrl = await api.files.getBlobUrl(fileId, encryptionVersion);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-gray-400">No files uploaded yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3 min-w-0">
            <File className="h-5 w-5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.file_name}
              </p>
              <p className="text-xs text-gray-500">
                {formatBytes(file.file_size)}
                {file.purpose && (
                  <> &middot; {file.purpose.replace(/_/g, " ")}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Download ${file.file_name}`}
              onClick={() => handleDownload(file.id, file.file_name, file.encryption_version)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              aria-label={`Delete ${file.file_name}`}
              disabled={deleting === file.id}
              onClick={() => handleDelete(file.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

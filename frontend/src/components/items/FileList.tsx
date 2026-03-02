"use client";

import { useState } from "react";
import { Check, Download, Eye, File, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { FileAttachmentType } from "@/lib/api";
import { PdfViewerOverlay } from "./InlineFileZone";

interface FileListProps {
  files: FileAttachmentType[];
  onDeleted: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isViewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export function FileList({ files, onDeleted }: FileListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pdfViewer, setPdfViewer] = useState<{ fileId: string; label: string; encryptionVersion?: number } | null>(null);
  const [imageLightbox, setImageLightbox] = useState<{ url: string; label: string } | null>(null);

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

  async function handleView(file: FileAttachmentType) {
    const displayLabel = file.display_name || file.file_name;

    if (file.mime_type === "application/pdf") {
      setPdfViewer({ fileId: file.id, label: displayLabel, encryptionVersion: file.encryption_version });
    } else if (file.mime_type.startsWith("image/")) {
      try {
        const url = await api.files.getBlobUrl(file.id, file.encryption_version);
        setImageLightbox({ url, label: displayLabel });
      } catch {
        // fallback — ignore
      }
    }
  }

  function closeLightbox() {
    if (imageLightbox) {
      URL.revokeObjectURL(imageLightbox.url);
      setImageLightbox(null);
    }
  }

  function startEditing(file: FileAttachmentType) {
    setEditingId(file.id);
    setEditValue(file.display_name || file.file_name);
  }

  async function saveRename(fileId: string) {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await api.files.rename(fileId, trimmed);
      setEditingId(null);
      onDeleted(); // refresh item data
    } catch (err) {
      console.error("Rename failed:", err);
    }
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-gray-400">No files uploaded yet.</p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {files.map((file) => {
          const displayLabel = file.display_name || file.file_name;
          const isEditing = editingId === file.id;

          return (
            <li key={file.id} className="flex items-center justify-between py-3 group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <File className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(file.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                        onClick={() => saveRename(file.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {displayLabel}
                      </p>
                      <button
                        onClick={() => startEditing(file)}
                        className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Rename file"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatBytes(file.file_size)}
                    {file.purpose &&
                      displayLabel.toLowerCase() !== file.purpose.replace(/_/g, " ").toLowerCase() && (
                      <> &middot; {file.purpose.replace(/_/g, " ")}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                {isViewable(file.mime_type) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`View ${displayLabel}`}
                    onClick={() => handleView(file)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Download ${displayLabel}`}
                  onClick={() => handleDownload(file.id, file.file_name, file.encryption_version)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  aria-label={`Delete ${displayLabel}`}
                  disabled={deleting === file.id}
                  onClick={() => handleDelete(file.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* PDF viewer overlay */}
      {pdfViewer && (
        <PdfViewerOverlay
          fileId={pdfViewer.fileId}
          label={pdfViewer.label}
          encryptionVersion={pdfViewer.encryptionVersion}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* Image lightbox overlay */}
      {imageLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageLightbox.url}
              alt={imageLightbox.label}
              className="rounded-lg shadow-2xl max-w-full max-h-[85vh] object-contain"
            />
            <p className="text-white text-sm text-center mt-2 opacity-80">{imageLightbox.label}</p>
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

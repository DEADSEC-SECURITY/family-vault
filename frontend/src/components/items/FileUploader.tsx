"use client";

import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ImageEditor } from "./ImageEditor";
import { createFileFromBlob } from "@/lib/image-utils";

interface FileUploaderProps {
  itemId: string;
  fileSlots: string[];
  onUploaded: () => void;
}

export function FileUploader({ itemId, fileSlots, onUploaded }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState(fileSlots[0] || "document");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Image editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");

  function cleanupEditor() {
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    setPendingImageSrc(null);
    setPendingFileName("");
    setEditorOpen(false);
  }

  const handleFile = useCallback((file: File) => {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File must be under 25 MB");
      return;
    }
    setError("");

    // If it's an image, open the editor first
    if (file.type.startsWith("image/")) {
      const blobUrl = URL.createObjectURL(file);
      setPendingImageSrc(blobUrl);
      setPendingFileName(file.name);
      setEditorOpen(true);
    } else {
      setSelectedFile(file);
    }
  }, []);

  function handleEditorSave(blob: Blob) {
    const editedFile = createFileFromBlob(blob, pendingFileName);
    setSelectedFile(editedFile);
    cleanupEditor();
  }

  function handleEditorCancel() {
    cleanupEditor();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError("");

    try {
      await api.files.upload(itemId, selectedFile, purpose);
      setSelectedFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {fileSlots.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor="purpose-select">File type</Label>
          <select
            id="purpose-select"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {fileSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300"
        }`}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-700">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Drag & drop a file here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">Max 25 MB</p>
            <input
              type="file"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {selectedFile && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? "Uploading & Encrypting..." : "Upload File"}
        </Button>
      )}

      {pendingImageSrc && (
        <ImageEditor
          open={editorOpen}
          imageSrc={pendingImageSrc}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          title="Edit Image"
        />
      )}
    </div>
  );
}

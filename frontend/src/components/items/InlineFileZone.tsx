"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  Pencil,
  X,
  ZoomIn,
  Eye,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Item } from "@/lib/api";
import { ImageEditor } from "./ImageEditor";
import { createFileFromBlob } from "@/lib/image-utils";

/* ──────────────────────── Slot Constants ──────────────────────── */

const SLOT_LABELS: Record<string, string> = {
  front_image: "Front of Card",
  back_image: "Back of Card",
  card_front: "Front of Card",
  card_back: "Back of Card",
  id_card_front: "Front of ID Card",
  id_card_back: "Back of ID Card",
  insurance_card: "Insurance Card",
  document: "Document",
  policy_document: "Policy Document",
};

function slotLabel(slot: string) {
  return SLOT_LABELS[slot] || slot.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Standard credit/ID card aspect ratio (~3.375 : 2.125) */
const CARD_ASPECT = 3.375 / 2.125; // ≈ 1.588

/** Insurance card aspect — measured from actual Progressive card (1865×803px) */
const INSURANCE_CARD_ASPECT = 1865 / 803; // ≈ 2.322

const CARD_SLOTS = new Set([
  "front_image", "back_image",
  "card_front", "card_back",
  "id_card_front", "id_card_back",
  "insurance_card",
]);

/** Per-slot aspect ratio overrides */
const SLOT_ASPECT_OVERRIDES: Record<string, number> = {
  insurance_card: INSURANCE_CARD_ASPECT,
};

function slotAspect(slot: string): number | undefined {
  if (SLOT_ASPECT_OVERRIDES[slot]) return SLOT_ASPECT_OVERRIDES[slot];
  return CARD_SLOTS.has(slot) ? CARD_ASPECT : undefined;
}

/* ──────────────────────── Auth Image Hook ──────────────────────── */

/** Loads an image via authenticated fetch and returns an object URL */
function useAuthImage(fileId: string | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    api.files.getBlobUrl(fileId).then((url) => {
      if (!cancelled) {
        urlRef.current = url;
        setBlobUrl(url);
      } else {
        URL.revokeObjectURL(url);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [fileId]);
  return blobUrl;
}

/** Detect whether a loaded image is portrait (taller than wide) */
function useImageOrientation(blobUrl: string | null): "landscape" | "portrait" | null {
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | null>(null);
  useEffect(() => {
    if (!blobUrl) { setOrientation(null); return; }
    const img = new Image();
    img.onload = () => {
      setOrientation(img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait");
    };
    img.src = blobUrl;
  }, [blobUrl]);
  return orientation;
}

/* ──────────────────────── InlineFileZone ──────────────────────── */

export function InlineFileZone({
  item,
  fileSlots,
  onUploaded,
}: {
  item: Item;
  fileSlots: string[];
  onUploaded: () => void;
}) {
  const slotFiles = item.files.filter((f) =>
    fileSlots.includes(f.purpose || ""),
  );

  // Determine if any slot has an uploaded file (to stretch empty slots to match)
  const hasAnyUpload = slotFiles.length > 0;

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState("");
  const [editingFile, setEditingFile] = useState<{ id: string; name: string; purpose: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const lightboxOrientation = useImageOrientation(lightboxUrl);

  async function handleEditSave(blob: Blob) {
    if (!editingFile) return;
    const editedFile = createFileFromBlob(blob, editingFile.name);
    try {
      await api.files.delete(editingFile.id);
      await api.files.upload(item.id, editedFile, editingFile.purpose);
      onUploaded();
    } catch (err) {
      console.error("Failed to save edited image:", err);
    }
    setEditorOpen(false);
    setLightboxUrl(null);
    setEditingFile(null);
  }

  return (
    <>
      <div className={`grid gap-4 ${fileSlots.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {fileSlots.map((slot) => {
          const existing = slotFiles.find((f) => f.purpose === slot);
          const isImage = existing?.mime_type?.startsWith("image/");
          return (
            <div key={slot}>
              {existing ? (
                <FileSlotDisplay
                  file={existing}
                  slot={slot}
                  isImage={!!isImage}
                  onDelete={async () => { await api.files.delete(existing.id); onUploaded(); }}
                  onEnlarge={(url, fileInfo) => {
                    setLightboxUrl(url);
                    setLightboxLabel(slotLabel(slot));
                    setEditingFile(fileInfo);
                  }}
                  onView={async () => {
                    const url = await api.files.getBlobUrl(existing.id);
                    window.open(url, "_blank");
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                />
              ) : (
                <FileSlotUploader
                  itemId={item.id}
                  slot={slot}
                  label={slotLabel(slot)}
                  onUploaded={onUploaded}
                  matchHeight={hasAnyUpload}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox overlay */}
      {lightboxUrl && !editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setLightboxUrl(null); setEditingFile(null); }}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt={lightboxLabel}
              className={`rounded-lg shadow-2xl max-w-full max-h-[85vh] object-contain ${
                lightboxOrientation === "portrait" ? "rotate-90" : ""
              }`}
            />
            <p className="text-white text-sm text-center mt-2 opacity-80">{lightboxLabel}</p>
            {/* Edit button */}
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="absolute -top-3 -right-12 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4 text-gray-700" />
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={() => { setLightboxUrl(null); setEditingFile(null); }}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      )}

      {/* Image editor (from lightbox edit) */}
      {editorOpen && lightboxUrl && (
        <ImageEditor
          open={editorOpen}
          imageSrc={lightboxUrl}
          onSave={handleEditSave}
          onCancel={() => setEditorOpen(false)}
          title={`Edit ${lightboxLabel}`}
          aspect={editingFile ? slotAspect(editingFile.purpose) : undefined}
        />
      )}
    </>
  );
}

/* ──────────────────────── File Slot Display ──────────────────────── */

function FileSlotDisplay({
  file,
  slot,
  isImage,
  onDelete,
  onEnlarge,
  onView,
}: {
  file: { id: string; file_name: string; mime_type: string; purpose?: string | null };
  slot: string;
  isImage: boolean;
  onDelete: () => void;
  onEnlarge: (blobUrl: string, fileInfo: { id: string; name: string; purpose: string }) => void;
  onView: () => void;
}) {
  const blobUrl = useAuthImage(isImage ? file.id : undefined);
  const isCard = CARD_SLOTS.has(slot);

  // For card slots use the appropriate aspect ratio; otherwise fall back to fixed h-40
  const aspect = slotAspect(slot);
  const containerStyle = isCard ? { aspectRatio: `${aspect}` } : undefined;
  const fallbackH = isCard ? "" : "h-40";

  return (
    <div className="relative group rounded-lg border bg-gray-50 overflow-hidden">
      {isImage && blobUrl ? (
        <div
          className="relative cursor-pointer overflow-hidden"
          style={containerStyle}
          onClick={() => onEnlarge(blobUrl, { id: file.id, name: file.file_name, purpose: slot })}
        >
          <img
            src={blobUrl}
            alt={slotLabel(slot)}
            className={`w-full ${fallbackH} object-cover`}
            style={isCard ? { width: "100%", height: "100%", objectFit: "cover" } : undefined}
          />
          {/* Hover zoom overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
          </div>
        </div>
      ) : isImage && !blobUrl ? (
        <div className={`w-full ${fallbackH} flex items-center justify-center`} style={containerStyle}>
          <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
        </div>
      ) : (
        <div className={`w-full ${fallbackH} flex items-center justify-center`} style={containerStyle}>
          <p className="text-xs text-gray-500 truncate px-3">{file.file_name}</p>
        </div>
      )}
      {/* Label bar with view + delete icons */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-t bg-white">
        <p className="text-[10px] text-gray-500">{slotLabel(slot)}</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          title="View in browser"
          className="text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Eye className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── PDF → Image helper ──────────────────────── */

async function pdfToImageSrc(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker is copied to /public by CopyPlugin in next.config.ts
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = 3; // High-res render for crisp crop
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;

  // Convert canvas to blob URL
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return URL.createObjectURL(blob);
}

/* ──────────────────────── File Slot Uploader ──────────────────────── */

function FileSlotUploader({
  itemId,
  slot,
  label,
  onUploaded,
  matchHeight,
}: {
  itemId: string;
  slot: string;
  label?: string;
  onUploaded: () => void;
  matchHeight?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  function handleFile(file: File) {
    if (file.type.startsWith("image/")) {
      // Open editor for images
      const src = URL.createObjectURL(file);
      setPendingFile(file);
      setPendingImageSrc(src);
      setEditorOpen(true);
    } else if (file.type === "application/pdf" && CARD_SLOTS.has(slot)) {
      // PDF in a card slot → convert first page to image, then open editor for cropping
      (async () => {
        setConverting(true);
        try {
          const src = await pdfToImageSrc(file);
          // Use original filename but .png extension for the cropped output
          const pngName = file.name.replace(/\.pdf$/i, ".png");
          setPendingFile(new File([new Blob()], pngName, { type: "image/png" }));
          setPendingImageSrc(src);
          setEditorOpen(true);
        } catch (err) {
          console.error("PDF conversion failed:", err);
          // Fall back to direct upload
          try {
            await api.files.upload(itemId, file, slot);
            onUploaded();
          } catch (uploadErr) {
            console.error("Upload failed:", uploadErr);
          }
        } finally {
          setConverting(false);
        }
      })();
    } else {
      // Direct upload for non-images (PDFs in non-card slots, docs, etc.)
      (async () => {
        try {
          await api.files.upload(itemId, file, slot);
          onUploaded();
        } catch (err) {
          console.error("Upload failed:", err);
        }
      })();
    }
  }

  async function handleEditorSave(blob: Blob) {
    setEditorOpen(false);
    if (pendingFile) {
      const editedFile = createFileFromBlob(blob, pendingFile.name);
      try {
        await api.files.upload(itemId, editedFile, slot);
        onUploaded();
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    cleanup();
  }

  function handleEditorCancel() {
    setEditorOpen(false);
    cleanup();
  }

  function cleanup() {
    if (pendingImageSrc) URL.revokeObjectURL(pendingImageSrc);
    setPendingFile(null);
    setPendingImageSrc(null);
  }

  return (
    <>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        style={CARD_SLOTS.has(slot) ? { aspectRatio: `${slotAspect(slot)}` } : undefined}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
          CARD_SLOTS.has(slot) ? "" : matchHeight ? "h-full min-h-[10.75rem]" : "h-36"
        } ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {converting ? (
          <>
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin mb-1.5" />
            <p className="text-xs text-blue-500 text-center leading-tight font-medium">
              Converting PDF…
            </p>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-gray-300 mb-1.5" />
            <p className="text-xs text-blue-500 text-center leading-tight font-medium">
              {label || slotLabel(slot)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Drop or click to upload
            </p>
          </>
        )}
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {/* Image editor (pre-upload) */}
      {editorOpen && pendingImageSrc && (
        <ImageEditor
          open={editorOpen}
          imageSrc={pendingImageSrc}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          title={`Edit ${label || slotLabel(slot)}`}
          aspect={slotAspect(slot)}
        />
      )}
    </>
  );
}

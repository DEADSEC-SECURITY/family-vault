/**
 * ImageEditor.tsx — Full-screen modal image editor for card photos.
 *
 * Opens as a Dialog when uploading or editing a card image (front/back).
 * Built on react-easy-crop for pan/zoom/crop.
 *
 * FEATURES:
 *   - Crop with enforced aspect ratio (card aspect ≈ 1.588 for card slots)
 *   - Rotate 90° CW / CCW
 *   - Zoom slider (1x to 10x)
 *   - Auto-detect card boundaries (uses detectCardBounds from image-utils.ts)
 *     → Runs edge detection, finds the card rectangle, sets crop + zoom
 *     → Auto-rotates if card is sideways (portrait detection → 90° CCW)
 *   - Brightness / contrast adjustments via CSS filters
 *   - Debug panel (only when NEXT_PUBLIC_DEBUG_DETECT="true")
 *
 * USAGE: <ImageEditor open={bool} imageSrc={url} onSave={fn} onCancel={fn} aspect={num} />
 *
 * KEY INTERNALS:
 *   getCropSize()         — mirrors react-easy-crop's internal crop size calculation
 *   applyCropFromBounds() — converts detected pixel bounds → crop/zoom values
 *   pendingAutoDetect ref — deferred crop application after rotation state update
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { getInitialCropFromCroppedAreaPixels } from "react-easy-crop";
import type { Area, MediaSize } from "react-easy-crop";
import { RotateCcw, RotateCw, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCroppedImage, detectCardBounds, type Area as CropArea, type DetectDebugInfo } from "@/lib/image-utils";

/** When true, auto-detect renders debug visualisations (blurred, edges, result). */
const DETECT_DEBUG = process.env.NEXT_PUBLIC_DEBUG_DETECT === "true";

/** Compute the crop box size — mirrors react-easy-crop's internal getCropSize.
 *  Must account for rotation just like the library does. */
function getCropSize(
  mediaW: number, mediaH: number,
  containerW: number, containerH: number,
  aspect: number,
  rotation: number = 0,
): { width: number; height: number } {
  // Apply rotation to media dimensions — matches the library's behaviour
  const rad = (rotation * Math.PI) / 180;
  const rotW = Math.abs(mediaW * Math.cos(rad)) + Math.abs(mediaH * Math.sin(rad));
  const rotH = Math.abs(mediaW * Math.sin(rad)) + Math.abs(mediaH * Math.cos(rad));
  const fittingW = Math.min(rotW, containerW);
  const fittingH = Math.min(rotH, containerH);
  if (fittingW > fittingH * aspect) {
    return { width: fittingH * aspect, height: fittingH };
  }
  return { width: fittingW, height: fittingW / aspect };
}

interface ImageEditorProps {
  open: boolean;
  imageSrc: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  title?: string;
  /** Optional fixed aspect ratio for the crop box (width/height). e.g. 1.586 for ID/credit cards. Omit for freeform. */
  aspect?: number;
}

export function ImageEditor({
  open,
  imageSrc,
  onSave,
  onCancel,
  title = "Edit Image",
  aspect,
}: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const [debugInfo, setDebugInfo] = useState<DetectDebugInfo | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const pendingAutoDetect = useRef<{ bounds: CropArea; rotation: number } | null>(null);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const onMediaLoaded = useCallback((ms: MediaSize) => {
    setMediaSize(ms);
  }, []);

  // After rotation changes, if there's a pending auto-detect, apply crop/zoom.
  // We use useEffect because the Cropper needs a render cycle to update after
  // rotation changes — onMediaLoaded doesn't re-fire on rotation changes.
  useEffect(() => {
    if (!pendingAutoDetect.current || !mediaSize || !cropContainerRef.current) return;
    if (pendingAutoDetect.current.rotation !== rotation) return; // not our rotation yet

    const { bounds, rotation: rot } = pendingAutoDetect.current;
    pendingAutoDetect.current = null;

    // Small delay to ensure Cropper has finished its internal layout after rotation
    requestAnimationFrame(() => {
      if (!cropContainerRef.current) return;
      const containerRect = cropContainerRef.current.getBoundingClientRect();
      const effectiveAspect = aspect || mediaSize.width / mediaSize.height;
      const cs = getCropSize(mediaSize.width, mediaSize.height, containerRect.width, containerRect.height, effectiveAspect, rot);
      const { crop: newCrop, zoom: newZoom } = getInitialCropFromCroppedAreaPixels(
        bounds, mediaSize, rot, cs, 1, 10,
      );
      setZoom(newZoom);
      setCrop(newCrop);
    });
  }, [rotation, mediaSize, aspect]);

  function handleRotateCW() {
    setRotation((r) => (r + 90) % 360);
  }

  function handleRotateCCW() {
    setRotation((r) => (r - 90 + 360) % 360);
  }

  /** Helper: given final rotation + bounds in rotated space, compute crop/zoom using current mediaSize */
  function applyCropFromBounds(
    bounds: CropArea,
    ms: MediaSize,
    rot: number,
  ) {
    if (!cropContainerRef.current) return;
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const cropSize = getCropSize(
      ms.width,
      ms.height,
      containerRect.width,
      containerRect.height,
      aspect || ms.width / ms.height,
      rot,
    );
    const { crop: newCrop, zoom: newZoom } = getInitialCropFromCroppedAreaPixels(
      bounds,
      ms,
      rot,
      cropSize,
      1,
      10,
    );
    setZoom(newZoom);
    setCrop(newCrop);
  }

  async function handleAutoDetect() {
    if (!mediaSize || !cropContainerRef.current) return;
    setDetecting(true);
    setDebugInfo(null);
    try {
      // Always detect on the original unrotated image
      const result = await detectCardBounds(imageSrc, DETECT_DEBUG, rotation);

      // Show debug info only in debug mode
      if (DETECT_DEBUG && result.debug) setDebugInfo(result.debug);

      if (!result.bounds) {
        setDetecting(false);
        return;
      }

      // result.bounds is already transformed to account for current rotation.
      // But we also need to check: is the card sideways relative to the crop aspect?
      // If crop box is landscape (aspect > 1) but the detected card is portrait
      // (taller than wide in rotated space), we should auto-rotate 90° CW.
      const detectedAr = result.bounds.width / result.bounds.height;
      const needsRotate = aspect && aspect > 1 && detectedAr < 1;

      if (needsRotate) {
        // Rotate 90° CCW to make the card landscape (reads correctly)
        const newRotation = (rotation + 270) % 360;
        setRotation(newRotation);

        // Re-compute bounds for the new rotation (detection is on original image,
        // just need different rotation transform)
        const newResult = await detectCardBounds(imageSrc, false, newRotation);
        if (!newResult.bounds) {
          // Fallback: apply with current bounds anyway
          applyCropFromBounds(result.bounds, mediaSize, rotation);
          return;
        }

        // Wait for mediaSize to update after rotation change, then apply crop.
        // We use onMediaLoaded callback which fires when Cropper re-renders.
        // Store the pending bounds and apply them when mediaSize updates.
        pendingAutoDetect.current = { bounds: newResult.bounds, rotation: newRotation };
      } else {
        // No rotation needed — apply directly
        applyCropFromBounds(result.bounds, mediaSize, rotation);
      }
    } catch (err) {
      console.error("Auto detect failed:", err);
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels, rotation);
      onSave(blob);
    } catch (err) {
      console.error("Failed to process image:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Crop and rotate the image before saving
          </DialogDescription>
        </DialogHeader>

        {/* Crop area */}
        <div ref={cropContainerRef} className="relative h-[400px] w-full rounded-lg overflow-hidden bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            maxZoom={10}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            objectFit="contain"
          />
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Rotate + Auto Detect buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotateCCW}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Rotate Left
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotateCW}
              className="gap-1.5"
            >
              <RotateCw className="h-4 w-4" />
              Rotate Right
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoDetect}
              disabled={detecting || !mediaSize}
              className="gap-1.5"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              Auto Detect
            </Button>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-gray-500 w-10 shrink-0">Zoom</span>
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={1}
              max={10}
              step={0.1}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-10 text-right shrink-0">
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Debug visualization panel — only rendered when NEXT_PUBLIC_DEBUG_DETECT=true */}
        {DETECT_DEBUG && debugInfo && (
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-700">Detection Debug</p>
              <button
                type="button"
                onClick={() => setDebugInfo(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Analysis: {debugInfo.analysisDims.w}×{debugInfo.analysisDims.h}px |
              Best: {debugInfo.bestComponent}
            </p>
            {/* eslint-disable @next/next/no-img-element */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Blurred</p>
                <img src={debugInfo.blurredImage} alt="Blurred grayscale" className="w-full rounded border" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Edges (Sobel)</p>
                <img src={debugInfo.edgesImage} alt="Edge map" className="w-full rounded border" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Result (green=detected)</p>
                <img src={debugInfo.dilatedImage} alt="Detection result" className="w-full rounded border" />
              </div>
            </div>
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Processing...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

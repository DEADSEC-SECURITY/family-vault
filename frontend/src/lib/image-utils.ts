/**
 * image-utils.ts — Client-side image manipulation utilities for FamilyVault.
 * Used by the ImageEditor component for crop, rotate, auto-detect, and export.
 *
 * EXPORTS:
 *   getCroppedImage(src, area, rotation, flip) — crops + rotates an image, returns a Blob
 *   detectCardBounds(src, debug, rotation)     — auto-detects card rectangle in a photo
 *   getImageDimensions(src)                    — returns natural width/height of an image
 *   createFileFromBlob(blob, name)             — wraps a Blob as a File for upload
 *
 * AUTO-DETECT ALGORITHM (detectCardBounds):
 *   Load image → grayscale → double Gaussian blur (5×5 kernel)
 *   Sobel edge detection (gradient magnitude)
 *   Build integral image (summed area table) for O(1) rectangle sums
 *   Coarse scan: test ~30 candidate rectangles across the image
 *   Fine scan: refine top candidates with smaller step sizes
 *   Score by min-side emphasis (all 4 borders must have edges)
 *   Transform bounds for current rotation (0°/90°/180°/270°)
 *   Optional debug canvas with edge visualization + green rectangle overlay
 *
 * DEBUG: Set NEXT_PUBLIC_DEBUG_DETECT="true" to show debug panel in ImageEditor.
 */

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Load an image from a URL and return the HTMLImageElement once loaded.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.setAttribute("crossOrigin", "anonymous");
    img.src = src;
  });
}

/**
 * Get the bounding box size when an image is rotated by `rotation` degrees.
 */
function getRotatedSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const rad = (rotation * Math.PI) / 180;
  const abs = Math.abs;
  return {
    width: abs(width * Math.cos(rad)) + abs(height * Math.sin(rad)),
    height: abs(width * Math.sin(rad)) + abs(height * Math.cos(rad)),
  };
}

/**
 * Crop and rotate an image using an offscreen canvas.
 *
 * @param imageSrc - The image source URL (blob URL or data URL)
 * @param cropAreaPixels - The pixel-based crop area from react-easy-crop's onCropComplete
 * @param rotation - Rotation in degrees (0, 90, 180, 270, or any value)
 * @returns A JPEG Blob of the cropped/rotated image
 */
export async function getCroppedImage(
  imageSrc: string,
  cropAreaPixels: Area,
  rotation: number = 0,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  // Draw the rotated image onto an intermediate canvas
  const rotatedSize = getRotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = Math.round(rotatedSize.width);
  rotCanvas.height = Math.round(rotatedSize.height);

  const rotCtx = rotCanvas.getContext("2d")!;
  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rotCtx.rotate((rotation * Math.PI) / 180);
  rotCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  // Crop from the rotated canvas
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.round(cropAreaPixels.width);
  cropCanvas.height = Math.round(cropAreaPixels.height);

  const cropCtx = cropCanvas.getContext("2d")!;
  cropCtx.drawImage(
    rotCanvas,
    Math.round(cropAreaPixels.x),
    Math.round(cropAreaPixels.y),
    Math.round(cropAreaPixels.width),
    Math.round(cropAreaPixels.height),
    0,
    0,
    Math.round(cropAreaPixels.width),
    Math.round(cropAreaPixels.height),
  );

  // Export as JPEG blob
  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export interface DetectDebugInfo {
  /** The blurred grayscale image as a data URL */
  blurredImage: string;
  /** The Sobel edge map rendered as a data URL */
  edgesImage: string;
  /** The dilated binary edge map as a data URL */
  dilatedImage: string;
  /** The connected components colored by label, with best-match rect drawn */
  componentsImage: string;
  /** Number of components found */
  componentCount: number;
  /** Info about the best component */
  bestComponent: string;
  /** The analysis dimensions */
  analysisDims: { w: number; h: number };
}

export interface DetectResult {
  bounds: Area | null;
  debug?: DetectDebugInfo;
}

/**
 * Detect the bounding rectangle of a card/document in a photo.
 *
 * Strategy: Use Sobel edge detection, then binary threshold the edge map,
 * then find connected components of strong edges.  Score candidate rectangles
 * by how well the edges align with the four sides of the bounding box
 * (i.e. how "rectangular" the blob is).  Pick the best one.
 *
 * This is robust to backgrounds that are partially lighter or darker than the
 * card because we look for a *rectangular cluster of edges*, not just a
 * brightness threshold.
 *
 * Returns null if detection fails or the card fills most of the image already.
 */
export async function detectCardBounds(
  imageSrc: string,
  debug: boolean = false,
  rotation: number = 0,
): Promise<DetectResult> {
  const image = await loadImage(imageSrc);
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;

  // Always detect on the ORIGINAL unrotated image for consistency,
  // then transform the detected bounds to the rotated coordinate space
  // that react-easy-crop expects.
  const MAX_DIM = 400;
  const scale = Math.min(MAX_DIM / natW, MAX_DIM / natH, 1);
  const w = Math.round(natW * scale);
  const h = Math.round(natH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // ── Grayscale ──
  const grayRaw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    grayRaw[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // ── Gaussian blur to suppress texture noise (carpet, wood grain, text) ──
  // Use a 5x5 Gaussian kernel (sigma ≈ 1.4) applied twice for stronger smoothing
  const gray = gaussianBlur(gaussianBlur(grayRaw, w, h), w, h);

  // ── Sobel edge magnitudes ──
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + (x + 1)];
      const ml = gray[y * w + (x - 1)];
      const mr = gray[y * w + (x + 1)];
      const bl = gray[(y + 1) * w + (x - 1)];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + (x + 1)];
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // ── Score candidate rectangles by edge alignment ──
  //
  // Key insight: a card's 4 edges will show up as *individual* strong lines
  // in the Sobel output.  We score each candidate rectangle by checking
  // how strong the edge signal is along each of its 4 thin border strips,
  // normalised per-pixel (average edge strength on the border).
  //
  // The previous interior-penalty approach failed because insurance cards
  // have logos & text that generate strong interior edges, making the
  // penalty dominate.  Instead, we focus purely on: "are there 4 strong
  // edge lines forming a rectangle?"

  const imageArea = w * h;
  const PAD = 2;

  // Adaptive border thickness: ~1.5% of image diagonal
  const BT = Math.max(2, Math.round(Math.sqrt(w * w + h * h) * 0.015));

  // Pre-compute integral image of edge magnitudes for fast rectangle-border sums
  const ie = new Float64Array((h + 1) * (w + 1));
  const ieW = w + 1;
  for (let y = 1; y <= h; y++) {
    for (let x = 1; x <= w; x++) {
      ie[y * ieW + x] =
        edges[(y - 1) * w + (x - 1)] +
        ie[(y - 1) * ieW + x] +
        ie[y * ieW + (x - 1)] -
        ie[(y - 1) * ieW + (x - 1)];
    }
  }

  // Returns the sum of edges[y][x] for x in [x1..x2], y in [y1..y2] (inclusive).
  function rectSum(x1: number, y1: number, x2: number, y2: number): number {
    // Clamp to valid pixel range
    const a = Math.max(0, x1);
    const b = Math.max(0, y1);
    const c = Math.min(w - 1, x2);
    const d = Math.min(h - 1, y2);
    if (c < a || d < b) return 0;
    // Integral image uses 1-based indexing offset
    return (
      ie[(d + 1) * ieW + (c + 1)] -
      ie[b * ieW + (c + 1)] -
      ie[(d + 1) * ieW + a] +
      ie[b * ieW + a]
    );
  }

  function scoreRect(x1: number, y1: number, x2: number, y2: number): number {
    const bw = x2 - x1;
    const bh = y2 - y1;
    if (bw < 15 || bh < 10) return -1;
    const boxArea = bw * bh;
    if (boxArea < imageArea * 0.02 || boxArea > imageArea * 0.9) return -1;

    const ar = bw / bh;
    if (ar > 6 || ar < 0.17) return -1;

    const bt = Math.min(BT, Math.floor(bw / 4), Math.floor(bh / 4));
    if (bt < 1) return -1;

    // Average edge energy on each of the 4 border strips
    const topPixels = bw * bt;
    const bottomPixels = bw * bt;
    const sideH = bh - 2 * bt;
    const leftPixels = bt * Math.max(1, sideH);
    const rightPixels = bt * Math.max(1, sideH);

    const topE = rectSum(x1, y1, x2 - 1, y1 + bt - 1) / topPixels;
    const bottomE = rectSum(x1, y2 - bt, x2 - 1, y2 - 1) / bottomPixels;
    const leftE = sideH > 0 ? rectSum(x1, y1 + bt, x1 + bt - 1, y2 - bt - 1) / leftPixels : 0;
    const rightE = sideH > 0 ? rectSum(x2 - bt, y1 + bt, x2 - 1, y2 - bt - 1) / rightPixels : 0;

    // We want ALL 4 sides to be strong.  Using the *minimum* of the 4
    // sides ensures we don't pick rectangles where only 1-2 sides have
    // edges (like a table edge or carpet boundary).
    const sides = [topE, bottomE, leftE, rightE];
    const minSide = Math.min(...sides);
    const avgSide = (topE + bottomE + leftE + rightE) / 4;

    // Score = geometric mean emphasising the weakest side
    // (minSide * avgSide) ensures all 4 sides must contribute
    const edgeScore = minSide * 0.6 + avgSide * 0.4;

    // Card-like aspect ratio bonus (credit cards are ~1.586)
    const cardAr = Math.max(ar, 1 / ar);
    let arBonus = 1.0;
    if (cardAr >= 1.3 && cardAr <= 2.0) arBonus = 1.5;
    else if (cardAr >= 1.0 && cardAr <= 2.5) arBonus = 1.2;

    // Mild size preference (larger rectangles slightly preferred, but not dominant)
    const sizeBonus = Math.pow(boxArea / imageArea, 0.15);

    // Penalize rectangles touching image edge
    const edgeDist = Math.min(x1, y1, w - 1 - x2, h - 1 - y2);
    const edgePenalty = edgeDist <= 0 ? 0.2 : edgeDist <= 2 ? 0.6 : 1.0;

    return edgeScore * arBonus * sizeBonus * edgePenalty * minSide;
  }

  // ── Coarse scan, then refine top candidates ──
  let bestScore = -Infinity;
  let bestBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  const COARSE = 6;
  const candidates: Array<{ x1: number; y1: number; x2: number; y2: number; score: number }> = [];

  // Scan all possible top-left / bottom-right corner pairs
  for (let y1 = PAD; y1 < h * 0.7; y1 += COARSE) {
    for (let x1 = PAD; x1 < w * 0.7; x1 += COARSE) {
      for (let y2 = y1 + Math.max(15, h * 0.1); y2 < h - PAD; y2 += COARSE) {
        for (let x2 = x1 + Math.max(20, w * 0.1); x2 < w - PAD; x2 += COARSE) {
          const s = scoreRect(x1, y1, x2, y2);
          if (s > 0) {
            candidates.push({ x1, y1, x2, y2, score: s });
          }
        }
      }
    }
  }

  // Sort and keep top 30 for refinement
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 30);

  // Fine refinement around each top candidate
  const REFINE = COARSE;
  for (const c of topCandidates) {
    for (let y1 = c.y1 - REFINE; y1 <= c.y1 + REFINE; y1++) {
      for (let x1 = c.x1 - REFINE; x1 <= c.x1 + REFINE; x1++) {
        for (let y2 = c.y2 - REFINE; y2 <= c.y2 + REFINE; y2++) {
          for (let x2 = c.x2 - REFINE; x2 <= c.x2 + REFINE; x2++) {
            if (x1 < PAD || y1 < PAD || x2 >= w - PAD || y2 >= h - PAD) continue;
            const s = scoreRect(x1, y1, x2, y2);
            if (s > bestScore) {
              bestScore = s;
              bestBounds = { minX: x1, minY: y1, maxX: x2, maxY: y2 };
            }
          }
        }
      }
    }
  }

  // ── Build debug info if requested ──
  let debugInfo: DetectDebugInfo | undefined;
  if (debug) {
    // Blurred grayscale visualization
    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext("2d")!;
    const blurImgData = blurCtx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(gray[i]);
      blurImgData.data[i * 4] = v;
      blurImgData.data[i * 4 + 1] = v;
      blurImgData.data[i * 4 + 2] = v;
      blurImgData.data[i * 4 + 3] = 255;
    }
    blurCtx.putImageData(blurImgData, 0, 0);

    // Edge magnitude visualization
    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = w;
    edgeCanvas.height = h;
    const edgeCtx = edgeCanvas.getContext("2d")!;
    const edgeImgData = edgeCtx.createImageData(w, h);
    let maxEdge = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] > maxEdge) maxEdge = edges[i];
    }
    for (let i = 0; i < w * h; i++) {
      const v = maxEdge > 0 ? Math.round((edges[i] / maxEdge) * 255) : 0;
      edgeImgData.data[i * 4] = v;
      edgeImgData.data[i * 4 + 1] = v;
      edgeImgData.data[i * 4 + 2] = v;
      edgeImgData.data[i * 4 + 3] = 255;
    }
    edgeCtx.putImageData(edgeImgData, 0, 0);

    // Result overlay — draw best rect on the rotated image
    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = w;
    resultCanvas.height = h;
    const resultCtx = resultCanvas.getContext("2d")!;
    // Draw from the already-rotated analysis canvas
    resultCtx.drawImage(canvas, 0, 0);
    resultCtx.fillStyle = "rgba(0,0,0,0.5)";
    resultCtx.fillRect(0, 0, w, h);

    if (bestBounds) {
      // Cut out the detected area to show it bright
      const bx = bestBounds.minX;
      const by = bestBounds.minY;
      const bww = bestBounds.maxX - bestBounds.minX + 1;
      const bhh = bestBounds.maxY - bestBounds.minY + 1;
      // Re-draw rotated image just in the detected rect area
      resultCtx.save();
      resultCtx.beginPath();
      resultCtx.rect(bx, by, bww, bhh);
      resultCtx.clip();
      resultCtx.drawImage(canvas, 0, 0);
      resultCtx.restore();
      // Green border
      resultCtx.strokeStyle = "#00ff00";
      resultCtx.lineWidth = 2;
      resultCtx.strokeRect(bx, by, bww, bhh);
    }

    let bestInfo = `none found (${candidates.length} coarse candidates)`;
    if (bestBounds) {
      const bw2 = bestBounds.maxX - bestBounds.minX;
      const bh2 = bestBounds.maxY - bestBounds.minY;
      bestInfo = `${bw2}x${bh2} at (${bestBounds.minX},${bestBounds.minY}), ar=${(bw2/bh2).toFixed(2)}, score=${bestScore.toFixed(1)}, candidates=${candidates.length}`;
    }

    debugInfo = {
      blurredImage: blurCanvas.toDataURL(),
      edgesImage: edgeCanvas.toDataURL(),
      dilatedImage: resultCanvas.toDataURL(),
      componentsImage: resultCanvas.toDataURL(),
      componentCount: candidates.length,
      bestComponent: bestInfo,
      analysisDims: { w, h },
    };
  }

  if (!bestBounds) return { bounds: null, debug: debugInfo };

  // Add a small inward margin to crop just inside the card edge
  const margin = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const left = Math.min(bestBounds.minX + margin, w - 1);
  const top = Math.min(bestBounds.minY + margin, h - 1);
  const right = Math.max(bestBounds.maxX - margin, 0);
  const bottom = Math.max(bestBounds.maxY - margin, 0);

  const detW = right - left;
  const detH = bottom - top;
  if (detW < w * 0.1 || detH < h * 0.1) return { bounds: null, debug: debugInfo };

  // Scale back to original natural image coordinates
  const origBounds = {
    x: Math.round(left / scale),
    y: Math.round(top / scale),
    width: Math.round(detW / scale),
    height: Math.round(detH / scale),
  };

  // Transform bounds from original image space → rotated bounding box space.
  // react-easy-crop's getInitialCropFromCroppedAreaPixels expects bounds
  // in the rotated bounding box coordinate system.
  const normRot = ((rotation % 360) + 360) % 360;
  let rotBounds: Area;
  if (normRot === 90) {
    rotBounds = {
      x: natH - origBounds.y - origBounds.height,
      y: origBounds.x,
      width: origBounds.height,
      height: origBounds.width,
    };
  } else if (normRot === 180) {
    rotBounds = {
      x: natW - origBounds.x - origBounds.width,
      y: natH - origBounds.y - origBounds.height,
      width: origBounds.width,
      height: origBounds.height,
    };
  } else if (normRot === 270) {
    rotBounds = {
      x: origBounds.y,
      y: natW - origBounds.x - origBounds.width,
      width: origBounds.height,
      height: origBounds.width,
    };
  } else {
    // rotation = 0 or non-90° increments — use as-is
    rotBounds = origBounds;
  }

  return {
    bounds: rotBounds,
    debug: debugInfo,
  };
}

/**
 * 5×5 Gaussian blur (sigma ≈ 1.4) on a Float32Array grayscale image.
 * Kills fine texture (carpet fibers, wood grain, small text) while
 * preserving strong structural edges (card borders).
 */
function gaussianBlur(src: Float32Array, w: number, h: number): Float32Array {
  // 5×5 Gaussian kernel, sigma ≈ 1.4, normalized
  const K = [
    1,  4,  7,  4, 1,
    4, 16, 26, 16, 4,
    7, 26, 41, 26, 7,
    4, 16, 26, 16, 4,
    1,  4,  7,  4, 1,
  ];
  const KSUM = 273; // sum of all kernel values
  const R = 2; // kernel radius

  const out = new Float32Array(w * h);
  for (let y = R; y < h - R; y++) {
    for (let x = R; x < w - R; x++) {
      let sum = 0;
      let ki = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          sum += src[(y + dy) * w + (x + dx)] * K[ki++];
        }
      }
      out[y * w + x] = sum / KSUM;
    }
  }
  // Copy border pixels unchanged
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < R || y >= h - R || x < R || x >= w - R) {
        out[y * w + x] = src[y * w + x];
      }
    }
  }
  return out;
}

/**
 * Get the natural dimensions of an image from its URL.
 */
export function getImageDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Wrap a Blob in a File object suitable for uploading via the API.
 * Keeps the original filename stem but changes the extension to .jpg.
 */
export function createFileFromBlob(
  blob: Blob,
  originalFileName: string,
): File {
  const stem = originalFileName.replace(/\.[^.]+$/, "");
  const name = `${stem}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}

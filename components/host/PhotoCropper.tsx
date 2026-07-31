"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";

const VIEW = 280; // on-screen size of the crop viewport, px
const OUTPUT = 400; // exported image size, px

/**
 * Decode an image file to something drawable.
 * createImageBitmap handles more formats and applies EXIF rotation;
 * the <img> path is the fallback for older browsers.
 */
async function decode(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

interface Transform {
  zoom: number; // 1 = image exactly covers the viewport
  x: number; // offset in screen px
  y: number;
}

/**
 * Drag-to-reposition, pinch/scroll-to-zoom square cropper.
 *
 * The image is always constrained to fully cover the crop square, so there's
 * no way to end up with empty edges. Exports a square JPEG.
 */
export default function PhotoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [t, setT] = useState<Transform>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  // Active pointers, for drag + pinch.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{
    startT: Transform;
    startX: number;
    startY: number;
    startDist: number;
  } | null>(null);

  // Load the file and normalise it to a JPEG data URL we can both display
  // and crop from. Tries createImageBitmap first (wider format support,
  // handles EXIF rotation), falls back to a plain <img>.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const source = await decode(file);
        if (cancelled) return;

        // Cap the working size — no need to hold a 12MP image in memory
        // just to produce a 400px avatar.
        const MAX = 1600;
        const scaleDown = Math.min(1, MAX / Math.max(source.width, source.height));
        const w = Math.round(source.width * scaleDown);
        const h = Math.round(source.height * scaleDown);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no-canvas");
        ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);

        const normalised = new Image();
        normalised.onload = () => {
          if (cancelled) return;
          setImg(normalised);
          setT({ zoom: 1, x: 0, y: 0 });
        };
        normalised.onerror = () => {
          if (!cancelled) setError("Could not read that image");
        };
        normalised.src = canvas.toDataURL("image/jpeg", 0.92);
      } catch {
        if (!cancelled) {
          setError(
            "Could not read that image. HEIC photos aren't supported by most browsers — " +
              "try a JPEG or PNG, or take a screenshot of the photo and use that.",
          );
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Scale at which the image exactly covers the viewport.
  const baseScale = img ? VIEW / Math.min(img.width, img.height) : 1;
  const scale = baseScale * t.zoom;
  const dispW = img ? img.width * scale : 0;
  const dispH = img ? img.height * scale : 0;

  /** Keep the image covering the viewport — no gaps at the edges. */
  const clamp = useCallback(
    (next: Transform): Transform => {
      if (!img) return next;
      const s = baseScale * next.zoom;
      const w = img.width * s;
      const h = img.height * s;
      return {
        zoom: next.zoom,
        x: Math.min(0, Math.max(VIEW - w, next.x)),
        y: Math.min(0, Math.max(VIEW - h, next.y)),
      };
    },
    [img, baseScale],
  );

  // Centre the image whenever zoom changes from a control rather than a gesture.
  useEffect(() => {
    if (!img) return;
    setT((prev) => clamp({ ...prev, x: (VIEW - dispW) / 2, y: (VIEW - dispH) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      startT: t,
      startX: pts[0].x,
      startY: pts[0].y,
      startDist: pts.length >= 2 ? dist(pts[0], pts[1]) : 0,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;

    if (pts.length >= 2 && g.startDist > 0) {
      // Pinch zoom, anchored on the viewport centre.
      const ratio = dist(pts[0], pts[1]) / g.startDist;
      const zoom = Math.min(5, Math.max(1, g.startT.zoom * ratio));
      const growth = zoom / g.startT.zoom;
      setT(
        clamp({
          zoom,
          x: VIEW / 2 - (VIEW / 2 - g.startT.x) * growth,
          y: VIEW / 2 - (VIEW / 2 - g.startT.y) * growth,
        }),
      );
    } else {
      // Single-finger / mouse drag.
      setT(
        clamp({
          zoom: g.startT.zoom,
          x: g.startT.x + (pts[0].x - g.startX),
          y: g.startT.y + (pts[0].y - g.startY),
        }),
      );
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    const growth = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const zoom = Math.min(5, Math.max(1, t.zoom * growth));
    const applied = zoom / t.zoom;
    setT(
      clamp({
        zoom,
        x: VIEW / 2 - (VIEW / 2 - t.x) * applied,
        y: VIEW / 2 - (VIEW / 2 - t.y) * applied,
      }),
    );
  }

  function setZoom(zoom: number) {
    const applied = zoom / t.zoom;
    setT(
      clamp({
        zoom,
        x: VIEW / 2 - (VIEW / 2 - t.x) * applied,
        y: VIEW / 2 - (VIEW / 2 - t.y) * applied,
      }),
    );
  }

  async function confirm() {
    if (!img) return;
    setBusy(true);
    try {
      // Map the visible viewport back to source-image pixels.
      const sx = -t.x / scale;
      const sy = -t.y / scale;
      const sSize = VIEW / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not process image");
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Could not encode image");
      onDone(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop image");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/50 bg-felt-800 shadow-2xl p-5">
        <h2 className="text-lg font-bold mb-1">Position photo</h2>
        <p className="text-white/50 text-xs mb-4">
          Drag to move · pinch or scroll to zoom
        </p>

        {error ? (
          <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-loss text-xs mb-4">
            {error}
          </div>
        ) : (
          <>
            <div
              ref={areaRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              style={{ width: VIEW, height: VIEW, touchAction: "none" }}
              className="relative mx-auto overflow-hidden rounded-xl bg-felt-900 cursor-move select-none"
            >
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: t.x,
                    top: t.y,
                    width: dispW,
                    height: dispH,
                    maxWidth: "none",
                  }}
                />
              )}
              {/* Circular mask preview — shows how it'll look as an avatar */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45) inset",
                  borderRadius: "50%",
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/60" />
            </div>

            <div className="flex items-center gap-3 mt-4">
              <span className="text-white/40 text-xs shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={5}
                step={0.01}
                value={t.zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-gold-500"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || !img || !!error}
            className="flex-1"
          >
            {busy ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

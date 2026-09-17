"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// A drawn signature, mouse or touch — both arrive as Pointer events, so one
// handler set covers both without a separate touch code path. The canvas is
// sized in device pixels (via devicePixelRatio) so the stroke stays crisp on
// high-DPI screens instead of drawing at CSS resolution and blurring on scale.
export function SignaturePad({
  disabled = false,
  onChange,
}: {
  disabled?: boolean;
  /** Fires with a PNG data URL after each stroke, or null once cleared/empty. */
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1410";
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokeRef.current = true;
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasStrokeRef.current) {
      setIsEmpty(false);
      onChange(canvasRef.current?.toDataURL("image/png") ?? null);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
    setIsEmpty(true);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative overflow-hidden rounded-md border bg-white text-[#1a1410] ${
          disabled ? "opacity-50" : "border-border"
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-36 w-full touch-none bg-white"
          style={{ cursor: disabled ? "default" : "crosshair" }}
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Draw your signature here
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled || isEmpty}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Eraser className="size-3.5" />
        Clear
      </button>
    </div>
  );
}

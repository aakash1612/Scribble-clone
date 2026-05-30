import { useRef, useEffect, useCallback, useState } from 'react';

// Fixed internal canvas resolution — both sender and receiver always work in this space
const CANVAS_W = 800;
const CANVAS_H = 600;

export function useCanvas(isDrawer, onDrawStart, onDrawMove, onDrawEnd) {
  const canvasRef = useRef(null);

  // ── Local drawing state (drawer's own input) ──────────────────────────────
  const isDrawing        = useRef(false);
  const localLastPos     = useRef(null);   // last raw canvas-space point
  const localLastMid     = useRef(null);   // last midpoint (for bezier continuity)
  const localStrokeStyle = useRef(null);

  // ── Remote drawing state (events arriving from server) ───────────────────
  // Completely separate from local refs so they never corrupt each other
  const remoteLastPos     = useRef(null);
  const remoteLastMid     = useRef(null);
  const remoteStrokeStyle = useRef(null);

  // ── RAF throttle for draw_move emissions ─────────────────────────────────
  // Queue instead of single ref — every point is enqueued, RAF drains all of them.
  // This prevents fast strokes from dropping intermediate points.
  const emitQueue = useRef([]);   // array of normalised positions waiting to be sent
  const rafId     = useRef(null);

  const [color,     setColor]     = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [tool,      setTool]      = useState('pen'); // 'pen' | 'eraser'

  const getCtx = useCallback(() => {
    const c = canvasRef.current;
    return c ? c.getContext('2d') : null;
  }, []);

  // Convert a mouse/touch event to NORMALISED coords (0–1).
  // Sending 0-1 means every client multiplies by their own canvas size
  // when drawing — eliminating all position drift from different window sizes.
  const getNormPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const cx = touch ? touch.clientX : e.clientX;
    const cy = touch ? touch.clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (cx - rect.left)  / rect.width)),
      y: Math.max(0, Math.min(1, (cy - rect.top)   / rect.height)),
    };
  }, []);

  // Convert normalised (0-1) → canvas pixel space (CANVAS_W × CANVAS_H)
  const toPixels = useCallback(({ x, y }) => ({
    x: x * CANVAS_W,
    y: y * CANVAS_H,
  }), []);

  // Apply stroke style to a context
  const applyStyle = useCallback((ctx, style) => {
    ctx.strokeStyle = style.isEraser ? '#ffffff' : style.color;
    ctx.fillStyle   = style.isEraser ? '#ffffff' : style.color;
    ctx.lineWidth   = style.isEraser ? style.size * 3 : style.size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, []);

  // Draw a dot at stroke start (so single clicks are visible)
  const drawDot = useCallback((ctx, pos, style) => {
    applyStyle(ctx, style);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.max(0.5, style.isEraser ? style.size * 1.5 : style.size / 2), 0, Math.PI * 2);
    ctx.fill();
  }, [applyStyle]);

  // Quadratic bezier segment using the midpoint technique.
  // Draws from `fromMid` to `toMid`, bending through `controlPt`.
  // This makes curves smooth regardless of how many points per second arrive.
  const drawBezierSegment = useCallback((ctx, fromMid, controlPt, toMid, style) => {
    applyStyle(ctx, style);
    ctx.beginPath();
    ctx.moveTo(fromMid.x, fromMid.y);
    ctx.quadraticCurveTo(controlPt.x, controlPt.y, toMid.x, toMid.y);
    ctx.stroke();
  }, [applyStyle]);

  // ── RAF loop — drain all queued points once per animation frame ──────────
  const startRAF = useCallback(() => {
    if (rafId.current) return;
    const loop = () => {
      if (!isDrawing.current) { rafId.current = null; return; }
      // Drain every queued point — not just the latest — so fast strokes are fully transmitted
      const queue = emitQueue.current;
      if (queue.length > 0) {
        const toSend = queue.splice(0, queue.length);
        for (const pt of toSend) onDrawMove(pt);
      }
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
  }, [onDrawMove]);

  const stopRAF = useCallback(() => {
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
  }, []);

  // ── Local drawing event handlers (drawer only) ────────────────────────────

  const handleMouseDown = useCallback((e) => {
    if (!isDrawer) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const normPos  = getNormPos(e, canvas);
    const pixelPos = toPixels(normPos);
    const isEraser = tool === 'eraser';
    const style    = { color, size: brushSize, isEraser };

    isDrawing.current        = true;
    localLastPos.current     = pixelPos;
    localLastMid.current     = pixelPos;   // first midpoint = start point itself
    localStrokeStyle.current = style;

    const ctx = getCtx();
    if (ctx) drawDot(ctx, pixelPos, style);

    onDrawStart({ x: normPos.x, y: normPos.y, color, size: brushSize, isEraser });
    startRAF();
  }, [isDrawer, color, brushSize, tool, getNormPos, toPixels, getCtx, drawDot, onDrawStart, startRAF]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawer || !isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const normPos  = getNormPos(e, canvas);
    const pixelPos = toPixels(normPos);
    const style    = localStrokeStyle.current;
    const lastPos  = localLastPos.current;
    const lastMid  = localLastMid.current;

    if (style && lastPos && lastMid) {
      const mid = { x: (lastPos.x + pixelPos.x) / 2, y: (lastPos.y + pixelPos.y) / 2 };
      const ctx = getCtx();
      if (ctx) drawBezierSegment(ctx, lastMid, lastPos, mid, style);
      localLastMid.current = mid;
      localLastPos.current = pixelPos;
    }

    // Enqueue position — RAF loop drains all of them, so no point is dropped
    emitQueue.current.push({ x: normPos.x, y: normPos.y });
  }, [isDrawer, getNormPos, toPixels, getCtx, drawBezierSegment]);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawer || !isDrawing.current) return;
    e.preventDefault();

    // Flush all queued positions before signalling end
    const remaining = emitQueue.current.splice(0, emitQueue.current.length);
    for (const pt of remaining) onDrawMove(pt);

    isDrawing.current    = false;
    localLastPos.current = null;
    localLastMid.current = null;
    stopRAF();
    onDrawEnd();
  }, [isDrawer, onDrawMove, onDrawEnd, stopRAF]);

  // ── Remote stroke renderer (viewers + late-join sync) ────────────────────
  // Uses completely separate refs — never touches localLastPos / localLastMid.

  const applyRemoteStroke = useCallback((stroke) => {
    const ctx = getCtx();
    if (!ctx) return;

    if (stroke.type === 'start') {
      const pixelPos = toPixels({ x: stroke.x, y: stroke.y });
      const style    = { color: stroke.color, size: stroke.size, isEraser: stroke.isEraser };
      remoteLastPos.current     = pixelPos;
      remoteLastMid.current     = pixelPos;
      remoteStrokeStyle.current = style;
      drawDot(ctx, pixelPos, style);

    } else if (stroke.type === 'move') {
      const lastPos = remoteLastPos.current;
      const lastMid = remoteLastMid.current;
      const style   = remoteStrokeStyle.current;
      if (!lastPos || !lastMid || !style) return;

      const pixelPos = toPixels({ x: stroke.x, y: stroke.y });
      const mid      = { x: (lastPos.x + pixelPos.x) / 2, y: (lastPos.y + pixelPos.y) / 2 };
      drawBezierSegment(ctx, lastMid, lastPos, mid, style);
      remoteLastMid.current = mid;
      remoteLastPos.current = pixelPos;

    } else if (stroke.type === 'end') {
      remoteLastPos.current = null;
      remoteLastMid.current = null;
    }
  }, [getCtx, toPixels, drawDot, drawBezierSegment]);

  // ── Full replay (undo, late-join, replay button) ──────────────────────────
  // Uses local variables — no shared refs needed.

  const replayStrokes = useCallback((strokes) => {
    const canvas = canvasRef.current;
    const ctx    = getCtx();
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    let rLastPos = null;
    let rLastMid = null;
    let rStyle   = null;

    for (const stroke of strokes) {
      if (stroke.type === 'start') {
        const pixelPos = toPixels({ x: stroke.x, y: stroke.y });
        rStyle   = { color: stroke.color, size: stroke.size, isEraser: stroke.isEraser };
        rLastPos = pixelPos;
        rLastMid = pixelPos;
        drawDot(ctx, pixelPos, rStyle);

      } else if (stroke.type === 'move' && rLastPos && rLastMid && rStyle) {
        const pixelPos = toPixels({ x: stroke.x, y: stroke.y });
        const mid      = { x: (rLastPos.x + pixelPos.x) / 2, y: (rLastPos.y + pixelPos.y) / 2 };
        drawBezierSegment(ctx, rLastMid, rLastPos, mid, rStyle);
        rLastMid = mid;
        rLastPos = pixelPos;

      } else if (stroke.type === 'end') {
        rLastPos = null;
        rLastMid = null;
      }
    }
  }, [getCtx, toPixels, drawDot, drawBezierSegment]);

  // ── Canvas initialisation ─────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, [getCtx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  // ── Event listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawer) return;

    const opts = { passive: false };
    canvas.addEventListener('mousedown',  handleMouseDown);
    canvas.addEventListener('mousemove',  handleMouseMove);
    canvas.addEventListener('mouseup',    handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('touchstart', handleMouseDown, opts);
    canvas.addEventListener('touchmove',  handleMouseMove, opts);
    canvas.addEventListener('touchend',   handleMouseUp,   opts);

    return () => {
      canvas.removeEventListener('mousedown',  handleMouseDown);
      canvas.removeEventListener('mousemove',  handleMouseMove);
      canvas.removeEventListener('mouseup',    handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleMouseDown);
      canvas.removeEventListener('touchmove',  handleMouseMove);
      canvas.removeEventListener('touchend',   handleMouseUp);
      stopRAF();
    };
  }, [isDrawer, handleMouseDown, handleMouseMove, handleMouseUp, stopRAF]);

  return {
    canvasRef,
    color,     setColor,
    brushSize, setBrushSize,
    tool,      setTool,
    clearCanvas,
    replayStrokes,
    applyRemoteStroke,
  };
}
